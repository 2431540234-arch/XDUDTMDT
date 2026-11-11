// M09 – Giỏ hàng: thêm/sửa/xóa theo variantId, kiểm tra tồn khả dụng, áp/gỡ mã giảm giá, tổng tiền do server tính.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qList, qNum, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { CatalogViews, PRODUCT_INCLUDE } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponsService, type CouponKind } from '../coupons/coupons.service';

export const FREE_SHIP_FROM = 10_000_000;
export const DEFAULT_SHIP_FEE = 30_000;

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Phí ship (UC-ORD-01): vùng trong settings.shippingZones khớp tỉnh của địa chỉ ⇒ dùng fee/freeFrom của vùng;
 * tỉnh không thuộc vùng nào ⇒ dùng settings.default_shipping_fee và settings.free_shipping_threshold (`defaults`);
 * tạm tính đạt ngưỡng miễn phí ⇒ 0.
 */
export function shippingFeeFor(
  zones: Array<{ name: string; fee: number; freeFrom?: number }>,
  province: string | null | undefined,
  subtotal: number,
  defaults: { fee: number; freeFrom: number } = { fee: DEFAULT_SHIP_FEE, freeFrom: FREE_SHIP_FROM },
): number {
  const zone = zones.find((z) => z.name === (province ?? ''));
  const fee = zone?.fee ?? defaults.fee;
  const freeFrom = zone?.freeFrom ?? defaults.freeFrom;
  return subtotal >= freeFrom ? 0 : fee;
}

const CART_INCLUDE = {
  coupon: true,
  cartItems: {
    orderBy: { id: 'asc' },
    include: {
      variant: {
        include: {
          product: { include: PRODUCT_INCLUDE },
          variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly coupons: CouponsService,
  ) {}

  /** Phí vận chuyển theo khu vực (settings.shippingZones khớp tỉnh của địa chỉ); đạt ngưỡng miễn phí ⇒ 0 */
  async shippingFee(userId: number, subtotal: number, addressId?: number | null, db: Db = this.prisma) {
    const [setting, defs, addr] = await Promise.all([
      db.setting.findUnique({ where: { key: 'shippingZones' } }),
      db.setting.findMany({ where: { key: { in: ['default_shipping_fee', 'free_shipping_threshold'] } } }),
      addressId
        ? db.address.findFirst({ where: { id: addressId, userId } })
        : db.address.findFirst({ where: { userId, isDefault: true } }),
    ]);
    const zones =
      (setting?.value as Array<{ name: string; fee: number; freeFrom?: number }> | undefined) ?? [];
    const num = (key: string, d: number) => {
      const v = Number(defs.find((x) => x.key === key)?.value);
      return Number.isFinite(v) && v >= 0 ? v : d;
    };
    return shippingFeeFor(zones, addr?.province, subtotal, {
      fee: num('default_shipping_fee', DEFAULT_SHIP_FEE),
      freeFrom: num('free_shipping_threshold', FREE_SHIP_FROM),
    });
  }

  private async ensure(userId: number, db: Db = this.prisma) {
    return (await db.cart.findUnique({ where: { userId } })) ?? db.cart.create({ data: { userId } });
  }

  /** CartView theo contract. itemIds: chỉ tính các dòng được chọn (mua ngay); addressId: tính phí ship theo tỉnh */
  async view(userId: number, opts: { itemIds?: number[]; addressId?: number | null } = {}) {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
    // Chưa có giỏ ⇒ trả giỏ rỗng, KHÔNG tạo bản ghi (DAC_TA UC-CART-02 3a); giỏ chỉ được tạo khi thêm hàng/áp mã
    if (!cart)
      return {
        id: 0,
        userId,
        items: [],
        itemCount: 0,
        subtotal: 0,
        discountAmount: 0,
        shippingFee: 0,
        total: 0,
        coupon: null,
      };
    const all = cart.cartItems;
    const items = opts.itemIds?.length ? all.filter((i) => opts.itemIds!.includes(i.id)) : all;
    const isSubset = items.length !== all.length;

    const lines = items.map((it) => {
      const v = it.variant;
      const p = v.product;
      const vv = this.views.variantViews(p).find((x) => x.id === v.id);
      const unit = this.views.effectivePrice(v);
      return {
        view: {
          id: it.id,
          cartId: it.cartId,
          variantId: it.variantId,
          quantity: it.quantity,
          createdAt: it.createdAt,
          updatedAt: it.updatedAt,
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          imageUrl: vv?.imageUrl ?? null,
          sku: v.sku,
          variantLabel: this.views.variantLabel(v),
          unitPrice: unit,
          originalPrice: Number(v.price),
          lineTotal: unit * it.quantity,
          stockQuantity: Math.max(0, v.stockQuantity),
        },
        categoryId: p.categoryId,
      };
    });
    const views = lines.map((l) => l.view);
    const subtotal = views.reduce((s, i) => s + i.lineTotal, 0);
    const shippingFee = views.length ? await this.shippingFee(userId, subtotal, opts.addressId) : 0;

    let discountAmount = 0;
    let coupon: {
      id: number;
      code: string;
      type: CouponKind;
      value: number;
    } | null = null;
    if (cart.coupon && !isSubset && views.length) {
      try {
        const r = await this.coupons.evaluate(
          cart.coupon.code,
          userId,
          lines.map((l) => ({
            productId: l.view.productId,
            categoryId: l.categoryId,
            lineTotal: l.view.lineTotal,
          })),
          subtotal,
          shippingFee,
        );
        discountAmount = r.discount;
        coupon = { id: r.coupon.id, code: r.coupon.code, type: r.kind, value: Number(r.coupon.value) };
      } catch {
        // mã không còn hợp lệ (hết hạn, hết lượt…) ⇒ gỡ khỏi giỏ
        await this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
      }
    }
    return {
      id: cart.id,
      userId,
      items: views,
      itemCount: views.reduce((s, i) => s + i.quantity, 0),
      subtotal,
      discountAmount,
      shippingFee,
      total: subtotal - discountAmount + shippingFee,
      coupon,
    };
  }

  getView(userId: number, q: RawQuery) {
    return this.view(userId, {
      itemIds: qList(q, 'items').map(Number),
      addressId: qNum(q, 'addressId', 0) || null,
    });
  }

  private stockError(available: number, variantId: number, always = false) {
    const msg =
      available > 0 || always
        ? `Chỉ còn ${Math.max(0, available)} sản phẩm trong kho.`
        : 'Sản phẩm tạm hết hàng.';
    return new AppException(ErrorCode.OUT_OF_STOCK, msg, { variantId, available: Math.max(0, available) });
  }

  async addItem(userId: number, raw: unknown) {
    const b = asBody(raw);
    const v = await this.prisma.productVariant.findFirst({
      where: { id: toId(b.variantId), isActive: true, product: { status: 'published', deletedAt: null } },
    });
    if (!v) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Biến thể sản phẩm không tồn tại.');
    const qty = Math.floor(Number(b.quantity ?? 1));
    if (!(qty >= 1)) new FieldErrors().add('quantity', 'Số lượng phải từ 1 trở lên.').throwIfAny();
    const cart = await this.ensure(userId);
    const available = v.stockQuantity;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
      });
      const total = (existing?.quantity ?? 0) + qty;
      if (total > available) throw this.stockError(available, v.id);
      if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: total } });
      else await tx.cartItem.create({ data: { cartId: cart.id, variantId: v.id, quantity: qty } });
    });
    return this.view(userId);
  }

  /**
   * Thêm NHIỀU dòng trong MỘT transaction (UC-SPACE-03: thêm bộ sản phẩm của không gian vào giỏ).
   * Có dòng không thêm được (ngừng bán / quá tồn) ⇒ 409 CONFLICT kèm details.unavailable và KHÔNG thêm dòng nào (transaction hoàn tác).
   */
  async addItems(
    userId: number,
    lines: Array<{ variantId: number; quantity: number; productId?: number; name?: string }>,
  ) {
    const cart = await this.ensure(userId);
    await this.prisma.$transaction(async (tx) => {
      const unavailable: Array<Record<string, unknown>> = [];
      for (const l of lines) {
        const v = await tx.productVariant.findFirst({
          where: { id: l.variantId, isActive: true, product: { status: 'published', deletedAt: null } },
        });
        const info = { variantId: l.variantId, productId: l.productId, name: l.name };
        if (!v) {
          unavailable.push({ ...info, reason: 'Sản phẩm tạm ngừng bán' });
          continue;
        }
        const existing = await tx.cartItem.findUnique({
          where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
        });
        const total = (existing?.quantity ?? 0) + l.quantity;
        if (total > v.stockQuantity) {
          unavailable.push({
            ...info,
            reason:
              v.stockQuantity > 0
                ? `Chỉ còn ${v.stockQuantity} sản phẩm trong kho.`
                : 'Sản phẩm tạm hết hàng.',
            available: Math.max(0, v.stockQuantity),
          });
          continue;
        }
        if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: total } });
        else await tx.cartItem.create({ data: { cartId: cart.id, variantId: v.id, quantity: l.quantity } });
      }
      if (unavailable.length)
        throw new AppException(
          ErrorCode.CONFLICT,
          'Có sản phẩm không thể thêm vào giỏ; chưa thêm sản phẩm nào.',
          {
            unavailable,
          },
        );
    });
    return this.view(userId);
  }

  private async ownItem(userId: number, id: number) {
    const cart = await this.ensure(userId);
    const it = await this.prisma.cartItem.findFirst({
      where: { id, cartId: cart.id },
      include: { variant: true },
    });
    if (!it) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Sản phẩm trong giỏ không tồn tại.');
    return it;
  }

  async updateItem(userId: number, id: number, raw: unknown) {
    const it = await this.ownItem(userId, id);
    const qty = Math.floor(Number(asBody(raw).quantity));
    if (!(qty >= 1)) new FieldErrors().add('quantity', 'Số lượng phải từ 1 trở lên.').throwIfAny();
    const available = it.variant.stockQuantity;
    if (qty > available) throw this.stockError(available, it.variantId, true);
    await this.prisma.cartItem.update({ where: { id }, data: { quantity: qty } });
    return this.view(userId);
  }

  async removeItem(userId: number, id: number) {
    await this.ownItem(userId, id);
    await this.prisma.cartItem.delete({ where: { id } });
    return this.view(userId);
  }

  async clear(userId: number) {
    const cart = await this.ensure(userId);
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } }),
    ]);
    return this.view(userId);
  }

  async applyCoupon(userId: number, raw: unknown) {
    const code = str(asBody(raw).code).trim();
    if (!code) new FieldErrors().add('code', 'Vui lòng nhập mã giảm giá.').throwIfAny();
    const view = await this.view(userId);
    if (!view.items.length) throw new AppException(ErrorCode.COUPON_INVALID, 'Giỏ hàng đang trống.');
    const cats = await this.prisma.product.findMany({
      where: { id: { in: view.items.map((i) => i.productId) } },
      select: { id: true, categoryId: true },
    });
    const catOf = new Map(cats.map((c) => [c.id, c.categoryId]));
    const r = await this.coupons.evaluate(
      code,
      userId,
      view.items.map((i) => ({
        productId: i.productId,
        categoryId: catOf.get(i.productId) ?? null,
        lineTotal: i.lineTotal,
      })),
      view.subtotal,
      view.shippingFee,
    );
    await this.prisma.cart.update({ where: { userId }, data: { couponId: r.coupon.id } });
    return this.view(userId);
  }

  async removeCoupon(userId: number) {
    await this.ensure(userId);
    await this.prisma.cart.update({ where: { userId }, data: { couponId: null } });
    return this.view(userId);
  }
}
