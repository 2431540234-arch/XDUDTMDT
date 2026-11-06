// UC-ADM-01 – Quản trị khách hàng: danh sách (lọc nhóm/trạng thái, tìm không dấu), chi tiết, tạo/sửa, ghi chú nội bộ,
// khóa/mở tài khoản (khóa ⇒ thu hồi mọi phiên, chặn đăng nhập và mọi request kể cả token còn hạn).
import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { EMAIL_RE, FieldErrors, PHONE_RE, asBody, str } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { AppConfig } from '../../config/app-config.service';
import { MAIL_SERVICE, type MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { activityText } from '../admin-stats/admin-stats.service';
import { ORDER_INCLUDE, OrderViewsService } from '../orders/order-views.service';
import { ReviewsService, REVIEW_INCLUDE } from '../reviews/reviews.service';
import { BCRYPT_COST, UsersService } from '../users/users.service';
import { WishlistService } from '../wishlist/wishlist.service';

const CUSTOMER_WHERE: Prisma.UserWhereInput = {
  deletedAt: null,
  userRoles: { some: { role: { code: 'user' } } },
};
const USER_INCLUDE = {
  userRoles: { include: { role: true } },
  avatarMedia: true,
} satisfies Prisma.UserInclude;

@Injectable()
export class AdminUsersService {
  private readonly log = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly orderViews: OrderViewsService,
    private readonly reviews: ReviewsService,
    private readonly wishlist: WishlistService,
    private readonly activity: ActivityLogService,
    private readonly config: AppConfig,
    @Inject(MAIL_SERVICE) private readonly mail: MailService,
  ) {}

  private async customer(id: number) {
    const u = await this.prisma.user.findFirst({ where: { id, ...CUSTOMER_WHERE }, include: USER_INCLUDE });
    if (!u) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Khách hàng không tồn tại.');
    return u;
  }

  async list(q: RawQuery) {
    const search = foldVi(qStr(q, 'q'));
    const group = qStr(q, 'group');
    const status = qStr(q, 'status');
    const rows = await this.prisma.user.findMany({ where: CUSTOMER_WHERE, include: USER_INCLUDE });
    const stats = await this.users.stats(rows.map((r) => r.id));
    let list = rows.map((u) => this.users.toView(u, stats.get(u.id)));
    if (search)
      list = list.filter((u) => foldVi(`${u.fullName} ${u.email} ${u.phone ?? ''}`).includes(search));
    if (group) list = list.filter((u) => u.customerGroup === group);
    if (status)
      list = list.filter((u) => (status === 'active' ? u.status === 'active' : u.status !== 'active'));
    const [field, dir] = (qStr(q, 'sort') || 'createdAt:desc').split(':');
    const key: Record<string, (u: (typeof list)[number]) => string | number> = {
      fullName: (u) => u.fullName,
      totalOrders: (u) => u.totalOrders,
      totalSpent: (u) => u.totalSpent,
      createdAt: (u) => u.createdAt.toISOString(),
    };
    const g = key[field] ?? key.createdAt;
    const mul = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => (g(a) === g(b) ? 0 : g(a) < g(b) ? -1 : 1) * mul);
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  async detail(id: number) {
    const u = await this.customer(id);
    const [stats, addresses, acts] = await Promise.all([
      this.users.stats([u.id]),
      this.prisma.address.findMany({
        where: { userId: u.id },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.activityLog.findMany({
        where: { actorId: u.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8,
      }),
    ]);
    return {
      ...this.users.toView(u, stats.get(u.id)),
      addresses,
      recentActivity: acts.map((a) => ({
        text: activityText(a.action, a.targetId, (a.changes ?? {}) as Record<string, unknown>),
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async setStatus(adminId: number, id: number, raw: unknown) {
    const u = await this.customer(id);
    const status = str(asBody(raw).status);
    if (!['active', 'suspended'].includes(status))
      new FieldErrors().add('status', 'Trạng thái không hợp lệ.').throwIfAny();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { status: status as 'active' | 'suspended' } });
      // khóa ⇒ thu hồi mọi refresh token; access token còn hạn bị JwtAuthGuard chặn ngay vì kiểm tra trạng thái mỗi request
      if (status === 'suspended')
        await tx.userSession.updateMany({
          where: { userId: u.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'user.update_status',
          targetType: 'user',
          targetId: u.id,
          changes: { status },
        },
        tx,
      );
    });
    return this.users.view(u.id);
  }

  async create(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    if (str(b.fullName).trim().length < 2) errs.add('fullName', 'Vui lòng nhập họ và tên.');
    if (!EMAIL_RE.test(str(b.email))) errs.add('email', 'Email không hợp lệ.');
    if (!PHONE_RE.test(str(b.phone))) errs.add('phone', 'Số điện thoại phải gồm 10 chữ số.');
    errs.throwIfAny();
    const email = str(b.email).trim().toLowerCase();
    if (await this.prisma.user.findFirst({ where: { email, deletedAt: null } })) {
      throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS, 'Email này đã tồn tại.');
    }
    // mật khẩu tạm ngẫu nhiên, gửi qua email; khách nên đổi hoặc dùng "Quên mật khẩu"
    const temp = randomBytes(6).toString('base64url');
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: 'user' } });
    const created = await this.prisma.user.create({
      data: {
        fullName: str(b.fullName).trim(),
        email,
        phone: str(b.phone),
        passwordHash: await hash(temp, BCRYPT_COST),
        emailVerifiedAt: new Date(),
        gender: b.gender ? str(b.gender) : null,
        birthday: b.birthday ? new Date(str(b.birthday)) : null,
        userRoles: { create: { roleId: role.id } },
        cart: { create: {} },
      },
    });
    await this.activity.log({
      actorId: adminId,
      action: 'user.create',
      targetType: 'user',
      targetId: created.id,
    });
    if (this.config.get('NODE_ENV') !== 'production') this.log.log(`Mật khẩu tạm của ${email}: ${temp}`);
    await this.mail.send({
      to: email,
      subject: 'Tài khoản Aurelia Living của bạn',
      text: `Mật khẩu tạm: ${temp}. Vui lòng đổi mật khẩu sau khi đăng nhập.`,
      html: `<p>Chào ${created.fullName}, cửa hàng đã tạo tài khoản cho bạn.</p><p>Mật khẩu tạm: <b>${temp}</b>. Vui lòng đổi sau khi đăng nhập.</p>`,
    });
    return this.users.view(created.id);
  }

  async update(adminId: number, id: number, raw: unknown) {
    const u = await this.customer(id);
    const b = asBody(raw);
    const errs = new FieldErrors();
    if (b.fullName !== undefined && str(b.fullName).trim().length < 2)
      errs.add('fullName', 'Vui lòng nhập họ và tên.');
    if (b.phone && !PHONE_RE.test(str(b.phone))) errs.add('phone', 'Số điện thoại phải gồm 10 chữ số.');
    errs.throwIfAny();
    await this.prisma.user.update({
      where: { id: u.id },
      data: {
        ...(b.fullName !== undefined ? { fullName: str(b.fullName).trim() } : {}),
        ...(b.phone !== undefined ? { phone: str(b.phone) || null } : {}),
        ...(b.adminNote !== undefined ? { adminNote: str(b.adminNote) || null } : {}),
        ...(b.gender !== undefined ? { gender: b.gender ? str(b.gender) : null } : {}),
        ...(b.birthday !== undefined ? { birthday: b.birthday ? new Date(str(b.birthday)) : null } : {}),
      },
    });
    await this.activity.log({ actorId: adminId, action: 'user.update', targetType: 'user', targetId: u.id });
    return this.users.view(u.id);
  }

  async orders(id: number, q: RawQuery) {
    const u = await this.customer(id);
    const where = { userId: u.id };
    const total = await this.prisma.order.count({ where });
    const page = resolvePage(q, total, 5);
    const rows = await this.prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: await this.orderViews.toViews(rows), page: page.page, pageSize: page.pageSize, total };
  }

  async customerReviews(id: number) {
    const u = await this.customer(id);
    const rows = await this.prisma.review.findMany({
      where: { userId: u.id },
      include: REVIEW_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.reviews.toView(r));
  }

  async customerWishlist(id: number) {
    const u = await this.customer(id);
    return this.wishlist.list(u.id);
  }
}
