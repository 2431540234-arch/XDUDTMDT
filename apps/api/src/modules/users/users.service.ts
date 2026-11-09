// M01 – Người dùng: hồ sơ cá nhân, UserView (kèm thống kê đơn), đổi mật khẩu.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { ErrorCode, type RoleCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { describeDevice } from '../../common/utils/device';
import { FieldErrors, PHONE_RE, asBody, str } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';

export const BCRYPT_COST = 10;

const USER_INCLUDE = {
  userRoles: { include: { role: true } },
  avatarMedia: true,
} satisfies Prisma.UserInclude;
export type UserRow = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly ingest: MediaIngestService,
  ) {}

  /** Thống kê đơn của nhiều khách một lượt: số đơn, tổng chi (trừ hủy/hoàn), đơn gần nhất */
  async stats(userIds: number[]) {
    const out = new Map<number, { totalOrders: number; totalSpent: number; lastOrderAt: string | null }>();
    if (!userIds.length) return out;
    const rows = await this.prisma.$queryRaw<
      Array<{
        user_id: number;
        total_orders: bigint;
        total_spent: Prisma.Decimal | null;
        last_order_at: Date | null;
      }>
    >`SELECT user_id, COUNT(*) AS total_orders,
             COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS total_spent,
             MAX(created_at) AS last_order_at
      FROM orders WHERE user_id IN (${Prisma.join(userIds)}) GROUP BY user_id`;
    for (const r of rows) {
      out.set(r.user_id, {
        totalOrders: Number(r.total_orders),
        totalSpent: Number(r.total_spent ?? 0),
        lastOrderAt: r.last_order_at ? r.last_order_at.toISOString() : null,
      });
    }
    return out;
  }

  /** UserView theo contract */
  toView(u: UserRow, s?: { totalOrders: number; totalSpent: number; lastOrderAt: string | null }) {
    const stats = s ?? { totalOrders: 0, totalSpent: 0, lastOrderAt: null };
    const { userRoles, avatarMedia, passwordHash: _p, ...base } = u;
    void _p;
    const roles = userRoles.map((r) => r.role.code as RoleCode);
    return {
      ...base,
      birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
      roles,
      avatarUrl: this.views.url(avatarMedia?.filePath),
      gender: (u.gender as 'male' | 'female' | 'other' | null) ?? null,
      customerGroup:
        stats.totalOrders >= 4 || stats.totalSpent >= 30_000_000 ? ('loyal' as const) : ('new' as const),
      loyaltyPoints: Math.floor(stats.totalSpent / 10_000),
      adminNote: u.adminNote ?? null,
      ...stats,
    };
  }

  async view(userId: number) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: USER_INCLUDE,
    });
    if (!u) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tài khoản không tồn tại.');
    const stats = await this.stats([u.id]);
    return this.toView(u, stats.get(u.id));
  }

  async updateMe(userId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    if (b.fullName !== undefined && str(b.fullName).trim().length < 2)
      errs.add('fullName', 'Vui lòng nhập họ và tên.');
    if (b.phone && !PHONE_RE.test(str(b.phone))) errs.add('phone', 'Số điện thoại phải gồm 10 chữ số.');
    errs.throwIfAny();

    const data: Prisma.UserUpdateInput = {};
    if (b.fullName !== undefined) data.fullName = str(b.fullName).trim();
    if (b.phone !== undefined) data.phone = str(b.phone) || null;
    if (b.gender !== undefined) data.gender = b.gender ? str(b.gender) : null;
    if (b.birthday !== undefined) data.birthday = b.birthday ? new Date(str(b.birthday)) : null;
    if (b.avatarUrl) {
      // FE gửi ảnh đại diện dạng data-URL (hoặc URL): kiểm tra, lưu kho, tạo media
      const mediaId = await this.ingest.ingestImage(str(b.avatarUrl), {
        userId,
        folder: `avatars/${userId}`,
        alt: str(b.fullName) || null,
      });
      data.avatarMedia = { connect: { id: mediaId } };
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    return this.view(userId);
  }

  // ------------------------------------------------------------ UC-ACC-03 phiên đăng nhập
  /** Phiên CHƯA thu hồi và CHƯA hết hạn của chính user; `current` = phiên của access token đang dùng */
  async sessions(userId: number, currentSessionId?: number) {
    const rows = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((s) => ({
      id: s.id,
      deviceName: s.deviceName ?? describeDevice(s.userAgent),
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  /** Đặt revokedAt cho phiên của CHÍNH user; phiên của người khác, đã thu hồi hoặc không có ⇒ 404 */
  async revokeSession(userId: number, sessionId: number) {
    const r = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (r.count === 0) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Phiên đăng nhập không tồn tại.');
    return null;
  }

  // ------------------------------------------------------------ UC-ACC-07 xóa tài khoản (xóa mềm)
  /**
   * Xóa mềm: kiểm tra mật khẩu, chặn khi còn đơn pending…shipping, rồi trong MỘT transaction đặt deletedAt, status = banned và
   * thu hồi mọi phiên. Không xóa cứng (đơn hàng giữ nguyên). Email được giải phóng nhờ partial unique uq_users_email_active.
   */
  async deleteMe(userId: number, raw: unknown) {
    const password = str(asBody(raw).password);
    const u = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });
    if (!u) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tài khoản không tồn tại.');
    if (u.userRoles.some((r) => r.role.code === 'admin'))
      throw new AppException(ErrorCode.FORBIDDEN, 'Tài khoản quản trị không thể tự xóa.');
    const errs = new FieldErrors();
    if (!password) errs.add('password', 'Vui lòng nhập mật khẩu để xác nhận.');
    else if (!(await compare(password, u.passwordHash))) errs.add('password', 'Mật khẩu không đúng.');
    errs.throwIfAny();
    await this.prisma.$transaction(async (tx) => {
      const open = await tx.order.count({
        where: { userId, status: { in: ['pending', 'confirmed', 'processing', 'shipping'] } },
      });
      if (open > 0)
        throw new AppException(
          ErrorCode.INVALID_STATE,
          `Bạn còn ${open} đơn hàng đang xử lý. Hãy hoàn tất hoặc hủy đơn trước khi xóa tài khoản.`,
        );
      await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: 'banned' } });
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return null;
  }

  async changePassword(userId: number, raw: unknown, currentSessionId?: number) {
    const b = asBody(raw);
    const current = str(b.currentPassword);
    const next = str(b.newPassword);
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!u) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tài khoản không tồn tại.');
    const errs = new FieldErrors();
    if (!(await compare(current, u.passwordHash)))
      errs.add('currentPassword', 'Mật khẩu hiện tại không đúng.');
    if (next.length < 8) errs.add('newPassword', 'Mật khẩu mới tối thiểu 8 ký tự.');
    else if (next === current) errs.add('newPassword', 'Mật khẩu mới phải khác mật khẩu cũ.');
    errs.throwIfAny();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hash(next, BCRYPT_COST) },
      }),
      // đổi mật khẩu: thu hồi các phiên KHÁC (trừ phiên hiện tại) nếu khách chọn "đăng xuất thiết bị khác" (DAC_TA UC-ACC-02)
      ...(b.logoutOthers
        ? [
            this.prisma.userSession.updateMany({
              where: {
                userId,
                revokedAt: null,
                ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
              },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);
    return null;
  }
}
