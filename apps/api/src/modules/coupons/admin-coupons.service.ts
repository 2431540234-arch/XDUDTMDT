// UC-ADM-19 – Quản trị khuyến mãi: CRUD 3 loại (percent | fixed | freeship), phạm vi (tất cả / danh mục / sản phẩm / không gian),
// đơn tối thiểu, giảm tối đa, thời gian, giới hạn lượt tổng và theo khách. Mã unique không phân biệt hoa thường.
// Trạng thái (đang diễn ra / sắp diễn ra / đã kết thúc) tính theo thời gian, không lưu.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { parseVnDate } from '../../common/utils/vn-date';
import { foldVi } from '../../common/utils/vi-fold';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponsService } from './coupons.service';

export type CouponState = 'active' | 'upcoming' | 'ended';

/** Trạng thái theo thời gian: đã kết thúc nếu tắt hoặc quá hạn; sắp diễn ra nếu chưa tới ngày bắt đầu */
export function couponState(
  c: { isActive: boolean; startsAt: Date; endsAt: Date | null },
  now = new Date(),
): CouponState {
  if (!c.isActive || (c.endsAt && c.endsAt < now)) return 'ended';
  if (c.startsAt > now) return 'upcoming';
  return 'active';
}

const SORTS = ['code', 'startsAt', 'usedCount'];

@Injectable()
export class AdminCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    private readonly activity: ActivityLogService,
  ) {}

  private view(c: Prisma.CouponGetPayload<{ include: { scopes: true } }>) {
    const { scopes, ...base } = c;
    const ids = (type: string) => scopes.filter((s) => s.targetType === type).map((s) => s.targetId);
    return {
      ...this.coupons.view(base),
      categoryIds: ids('category'),
      productIds: ids('product'),
      spaceIds: ids('space'),
    };
  }

  async list(q: RawQuery) {
    const all = await this.prisma.coupon.findMany({ include: { scopes: true } });
    const now = new Date();
    const counts = {
      all: all.length,
      active: all.filter((c) => couponState(c, now) === 'active').length,
      upcoming: all.filter((c) => couponState(c, now) === 'upcoming').length,
      ended: all.filter((c) => couponState(c, now) === 'ended').length,
    };
    const tab = qStr(q, 'tab');
    const kind = qStr(q, 'kind');
    const search = foldVi(qStr(q, 'q'));
    let list = all.map((c) => this.view(c));
    if (tab && tab !== 'all') list = list.filter((c) => couponState(c, now) === tab);
    if (kind) list = list.filter((c) => c.kind === kind);
    if (search) list = list.filter((c) => foldVi(`${c.code} ${c.name}`).includes(search));
    const [field, dir] = (qStr(q, 'sort') || 'startsAt:desc').split(':');
    const f = SORTS.includes(field) ? field : 'startsAt';
    const mul = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const x = (a as Record<string, unknown>)[f] as string | number;
      const y = (b as Record<string, unknown>)[f] as string | number;
      return (x === y ? 0 : x < y ? -1 : 1) * mul;
    });
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
      counts,
    };
  }

  async get(id: number) {
    const c = await this.prisma.coupon.findUnique({ where: { id }, include: { scopes: true } });
    if (!c) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Khuyến mãi không tồn tại.');
    return this.view(c);
  }

  private async validate(b: Record<string, unknown>, selfId?: number, usedCount = 0) {
    const errs = new FieldErrors();
    if (str(b.name).trim().length < 2) errs.add('name', 'Vui lòng nhập tên chương trình.');
    const code = str(b.code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,20}$/.test(code)) errs.add('code', 'Mã gồm 4–20 ký tự chữ in hoa hoặc số.');
    else if (
      await this.prisma.coupon.findFirst({ where: { code, ...(selfId ? { id: { not: selfId } } : {}) } })
    ) {
      errs.add('code', 'Mã khuyến mãi đã tồn tại.');
    }
    const kind = str(b.kind);
    if (!['percent', 'fixed', 'freeship'].includes(kind)) errs.add('kind', 'Vui lòng chọn loại giảm giá.');
    if (kind === 'percent' && !(Number(b.value) > 0 && Number(b.value) <= 100))
      errs.add('value', 'Phần trăm giảm từ 1 đến 100.');
    if (kind === 'fixed' && !(Number(b.value) > 0)) errs.add('value', 'Giá trị giảm phải lớn hơn 0.');
    if (!b.startsAt) errs.add('startsAt', 'Vui lòng chọn ngày bắt đầu.');
    if (!b.endsAt) errs.add('endsAt', 'Vui lòng chọn ngày kết thúc.');
    else if (b.startsAt && parseVnDate(str(b.endsAt), 'end') <= parseVnDate(str(b.startsAt), 'start'))
      errs.add('endsAt', 'Ngày kết thúc phải sau ngày bắt đầu.');
    if (b.maxDiscount && Number(b.maxDiscount) < 0) errs.add('maxDiscount', 'Giảm tối đa không hợp lệ.');
    if (b.minOrderValue && Number(b.minOrderValue) < 0)
      errs.add('minOrderValue', 'Đơn tối thiểu không hợp lệ.');
    if (b.usageLimit) {
      const lim = Number(b.usageLimit);
      if (!(lim >= 1)) errs.add('usageLimit', 'Giới hạn lượt phải từ 1 trở lên.');
      else if (lim < usedCount)
        errs.add('usageLimit', `Giới hạn lượt không được nhỏ hơn số lượt đã dùng (${usedCount}).`);
    }
    if (b.perUserLimit && !(Number(b.perUserLimit) >= 1))
      errs.add('perUserLimit', 'Giới hạn lượt mỗi khách phải từ 1 trở lên.');
    errs.throwIfAny();
    return code;
  }

  /** Nhãn phạm vi hiển thị (giống mock) */
  private async label(appliesTo: string, categoryIds: number[], productIds: number[], spaceIds: number[]) {
    if (appliesTo === 'category') {
      const cats = await this.prisma.category.findMany({ where: { id: { in: categoryIds } } });
      return cats.length ? `Danh mục: ${cats.map((c) => c.name).join(', ')}` : 'Theo danh mục';
    }
    if (appliesTo === 'product') {
      const ps = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { name: true },
        take: 3,
      });
      return ps.length
        ? `Sản phẩm: ${ps.map((p) => p.name).join(', ')}${productIds.length > 3 ? '…' : ''}`
        : 'Theo sản phẩm';
    }
    if (appliesTo === 'space') {
      const ss = await this.prisma.space.findMany({
        where: { id: { in: spaceIds } },
        select: { title: true },
        take: 3,
      });
      return ss.length ? `Không gian: ${ss.map((s) => s.title).join(', ')}` : 'Theo không gian mẫu';
    }
    return 'Tất cả sản phẩm';
  }

  private async save(id: number | null, b: Record<string, unknown>, adminId: number) {
    const cur = id ? await this.prisma.coupon.findUnique({ where: { id } }) : null;
    const code = await this.validate(b, id ?? undefined, cur?.usedCount ?? 0);
    const kind = str(b.kind) as 'percent' | 'fixed' | 'freeship';
    const appliesTo = ['all', 'category', 'product', 'space'].includes(str(b.appliesTo))
      ? str(b.appliesTo)
      : 'all';
    const ids = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).map(toId).filter(Boolean) : []);
    const categoryIds = appliesTo === 'category' ? ids('categoryIds') : [];
    const productIds = appliesTo === 'product' ? ids('productIds') : [];
    const spaceIds = appliesTo === 'space' ? ids('spaceIds') : [];
    const data = {
      code,
      type: kind,
      value: kind === 'freeship' ? 0 : Number(b.value),
      maxDiscount: b.maxDiscount ? Number(b.maxDiscount) : null,
      minOrderValue: Number(b.minOrderValue) || 0,
      usageLimit: b.usageLimit ? Number(b.usageLimit) : null,
      perUserLimit: b.perUserLimit ? Number(b.perUserLimit) : null,
      // chỉ gửi ngày (YYYY-MM-DD) ⇒ ngày giờ Việt Nam: bắt đầu từ 00:00, hết hạn lúc 23:59:59 của ngày đó
      startsAt: parseVnDate(str(b.startsAt), 'start'),
      endsAt: parseVnDate(str(b.endsAt), 'end'),
      isActive: b.isActive !== false,
      name: str(b.name).trim(),
      description: str(b.description) || null,
      appliesTo,
      appliesToLabel: await this.label(appliesTo, categoryIds, productIds, spaceIds),
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = id ? await tx.coupon.update({ where: { id }, data }) : await tx.coupon.create({ data });
      await tx.couponScope.deleteMany({ where: { couponId: row.id } });
      const scopes = [
        ...categoryIds.map((targetId) => ({ couponId: row.id, targetType: 'category', targetId })),
        ...productIds.map((targetId) => ({ couponId: row.id, targetType: 'product', targetId })),
        ...spaceIds.map((targetId) => ({ couponId: row.id, targetType: 'space', targetId })),
      ];
      if (scopes.length) await tx.couponScope.createMany({ data: scopes, skipDuplicates: true });
      await this.activity.log(
        {
          actorId: adminId,
          action: id ? 'coupon.update' : 'coupon.create',
          targetType: 'coupon',
          targetId: row.id,
          changes: { code },
        },
        tx,
      );
      return row;
    });
    return this.get(saved.id);
  }

  create(adminId: number, raw: unknown) {
    return this.save(null, asBody(raw), adminId);
  }

  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.get(id);
    // FE gửi một phần (ví dụ { isActive: false }) ⇒ trộn với giá trị hiện tại
    return this.save(id, { ...cur, ...asBody(raw) }, adminId);
  }

  /** Đã có lượt dùng ⇒ chỉ ngừng kích hoạt (giữ lịch sử); chưa dùng ⇒ xóa hẳn */
  async remove(adminId: number, id: number) {
    const c = await this.prisma.coupon.findUnique({ where: { id } });
    if (!c) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Khuyến mãi không tồn tại.');
    const used = await this.prisma.couponUsage.count({ where: { couponId: id } });
    if (used > 0) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      await this.activity.log({
        actorId: adminId,
        action: 'coupon.deactivate',
        targetType: 'coupon',
        targetId: id,
      });
      return this.get(id);
    }
    await this.prisma.$transaction([
      this.prisma.cart.updateMany({ where: { couponId: id }, data: { couponId: null } }),
      this.prisma.coupon.delete({ where: { id } }),
    ]);
    await this.activity.log({
      actorId: adminId,
      action: 'coupon.delete',
      targetType: 'coupon',
      targetId: id,
    });
    return null;
  }
}
