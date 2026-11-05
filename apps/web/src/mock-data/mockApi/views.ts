// Chuyển hàng trong db thành "view" mà API trả về (entity DB + quan hệ mở rộng) – xem src/types/api.ts
import type { Product, Product3DModel } from '@aurelia-living/shared-types';
import type {
  AddressView,
  CartItemView,
  CartView,
  CategoryNode,
  ColorOption,
  CouponView,
  Model3DView,
  NotificationView,
  OrderView,
  PanoramaView,
  ProductDetail,
  ProductListItem,
  ReviewView,
  SpaceDetail,
  SpaceListItem,
  UserCouponView,
  UserView,
  VariantView,
} from '@/types/api';
import type { Db } from '../db';
import { MOCK_NOW } from '../utils/rng';
import { ApiFail } from './http';

export const FREE_SHIP_FROM = 10_000_000;
export const DEFAULT_SHIP_FEE = 30_000;
export const COMBO_DISCOUNT_PERCENT = 10;
export const RETURN_WINDOW_DAYS = 7;

export const now = () => new Date();

export function mediaPath(db: Db, id: number | null | undefined): string | null {
  if (!id) return null;
  return db.media.find((m) => m.id === id)?.filePath ?? null;
}

const attrValue = (db: Db, variantId: number, attributeId: number): string | null => {
  const link = db.variantAttributeValues.find(
    (x) => x.variantId === variantId && x.attributeId === attributeId,
  );
  if (!link) return null;
  return db.attributeValues.find((v) => v.id === link.attributeValueId)?.value ?? null;
};
const attrValueId = (db: Db, variantId: number, attributeId: number): number | null =>
  db.variantAttributeValues.find((x) => x.variantId === variantId && x.attributeId === attributeId)
    ?.attributeValueId ?? null;

export function colorOfVariant(db: Db, variantId: number): ColorOption | null {
  const vid = attrValueId(db, variantId, 1);
  if (!vid) return null;
  const name = db.attributeValues.find((v) => v.id === vid)!.value;
  return { name, hex: db.colorHexByValueId[vid] ?? '#cccccc' };
}

export const effectivePrice = (v: { price: number; salePrice: number | null }) => v.salePrice ?? v.price;

export function variantLabel(db: Db, variantId: number | null): string {
  if (!variantId) return '—';
  const parts = [attrValue(db, variantId, 1), attrValue(db, variantId, 2)].filter(
    (x): x is string => Boolean(x) && x !== 'Tiêu chuẩn',
  );
  return parts.length ? parts.join(' / ') : 'Tiêu chuẩn';
}

// ---------------- Danh mục ----------------
export function categoryTree(db: Db, includeInactive = false): CategoryNode[] {
  const published = db.products.filter((p) => p.status === 'published' && !p.deletedAt);
  const count = (id: number) =>
    (includeInactive ? db.products : published).filter((p) => p.categoryId === id).length;
  const node = (c: Db['categories'][number]): CategoryNode => {
    const extra = db.categoryExtras[c.id];
    const children = db.categories
      .filter((x) => x.parentId === c.id && (includeInactive || x.isActive))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(node);
    return {
      ...c,
      imageUrl: mediaPath(db, c.imageMediaId),
      productCount: children.length
        ? children.reduce((s, x) => s + x.productCount, 0) + count(c.id)
        : count(c.id),
      parentName: c.parentId ? (db.categories.find((x) => x.id === c.parentId)?.name ?? null) : null,
      children,
      description: extra?.description ?? null,
      isFeatured: extra?.isFeatured ?? false,
    };
  };
  return db.categories
    .filter((c) => c.parentId === null && (includeInactive || c.isActive))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(node);
}

/** id danh mục + toàn bộ danh mục con */
export function categoryIdsWithChildren(db: Db, slug: string): number[] {
  const root = db.categories.find((c) => c.slug === slug);
  if (!root) return [];
  return [root.id, ...db.categories.filter((c) => c.parentId === root.id).map((c) => c.id)];
}

// ---------------- Sản phẩm ----------------
export function defaultVariant(db: Db, productId: number) {
  const vs = db.productVariants
    .filter((v) => v.productId === productId && v.isActive)
    .sort((a, b) => a.id - b.id);
  if (!vs.length) return null;
  const firstColor = colorOfVariant(db, vs[0].id)?.name;
  const group = vs.filter((v) => colorOfVariant(db, v.id)?.name === firstColor);
  return group[Math.min(1, group.length - 1)] ?? vs[0];
}

export function productListItem(db: Db, p: Product, userId?: number | null): ProductListItem {
  const variants = db.productVariants.filter((v) => v.productId === p.id && v.isActive);
  const dv = defaultVariant(db, p.id) ?? variants[0];
  const extra = db.productExtras.find((e) => e.productId === p.id);
  const cat = db.categories.find((c) => c.id === p.categoryId);
  const brand = db.brands.find((b) => b.id === p.brandId);
  const colors: ColorOption[] = [];
  const sizes: string[] = [];
  for (const v of variants) {
    const c = colorOfVariant(db, v.id);
    if (c && !colors.some((x) => x.name === c.name)) colors.push(c);
    const s = attrValue(db, v.id, 2);
    if (s && !sizes.includes(s)) sizes.push(s);
  }
  const primary = db.productImages.find((i) => i.productId === p.id && i.isPrimary);
  return {
    ...p,
    price: dv?.price ?? 0,
    salePrice: dv?.salePrice ?? null,
    stockQuantity: variants.reduce((s, v) => s + v.stockQuantity, 0),
    defaultVariantId: dv?.id ?? 0,
    thumbnailUrl: mediaPath(db, primary?.mediaId),
    category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
    brand: brand ? { id: brand.id, name: brand.name } : null,
    colors,
    sizes,
    material: dv ? attrValue(db, dv.id, 3) : null,
    style: extra?.style ?? null,
    sku: dv?.sku ?? '',
    isWishlisted: userId ? db.wishlists.some((w) => w.userId === userId && w.productId === p.id) : false,
  };
}

export function variantViews(db: Db, productId: number): VariantView[] {
  const vs = db.productVariants.filter((v) => v.productId === productId).sort((a, b) => a.id - b.id);
  return vs.map((v) => {
    const color = colorOfVariant(db, v.id);
    const sameColor = vs.filter((x) => colorOfVariant(db, x.id)?.name === color?.name).map((x) => x.id);
    const img = db.productImages.find(
      (i) => i.productId === productId && i.variantId !== null && sameColor.includes(i.variantId),
    );
    const primary = db.productImages.find((i) => i.productId === productId && i.isPrimary);
    return {
      ...v,
      color,
      size: attrValue(db, v.id, 2),
      material: attrValue(db, v.id, 3),
      imageUrl: mediaPath(db, (img ?? primary)?.mediaId),
    };
  });
}

export function model3DView(db: Db, m: Product3DModel): Model3DView {
  const files = db.modelFiles
    .filter((f) => f.modelId === m.id)
    .map((f) => {
      const md = db.media.find((x) => x.id === f.mediaId)!;
      return { ...f, url: md.filePath, fileName: md.fileName, fileSize: md.fileSize };
    });
  return {
    ...m,
    files,
    glbUrl: files.find((f) => f.format === 'glb')?.url ?? null,
    usdzUrl: files.find((f) => f.format === 'usdz')?.url ?? null,
    posterUrl: mediaPath(db, m.posterMediaId),
  };
}

export function productDetail(db: Db, p: Product, userId?: number | null): ProductDetail {
  const base = productListItem(db, p, userId);
  const extra = db.productExtras.find((e) => e.productId === p.id);
  const imgs = db.productImages.filter((i) => i.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const approved = db.reviews.filter((r) => r.productId === p.id && r.status === 'approved');
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  approved.forEach((r) => (breakdown[r.rating as 1 | 2 | 3 | 4 | 5] += 1));
  const model = db.product3dModels.find((m) => m.productId === p.id && m.isPrimary && m.status === 'ready');
  const cat = db.categories.find((c) => c.id === p.categoryId);
  return {
    ...base,
    images: imgs.map((i) => ({
      id: i.id,
      url: mediaPath(db, i.mediaId) ?? '',
      isPrimary: i.isPrimary,
      sortOrder: i.sortOrder,
      variantId: i.variantId,
    })),
    variants: variantViews(db, p.id),
    specs: extra?.specs ?? [],
    features: extra?.features ?? [],
    model: model ? model3DView(db, model) : null,
    ratingBreakdown: breakdown,
    questionCount: db.productQuestions.filter(
      (q) => q.productId === p.id && q.status === 'answered' && q.isPublic,
    ).length,
    breadcrumb: [
      { label: 'Sản phẩm', href: '/products' },
      ...(cat ? [{ label: cat.name, href: `/products?category=${cat.slug}` }] : []),
    ],
  };
}

// ---------------- Đánh giá ----------------
export function reviewView(db: Db, r: Db['reviews'][number]): ReviewView {
  const user = db.users.find((u) => u.id === r.userId);
  const product = db.products.find((p) => p.id === r.productId)!;
  const order = r.orderId ? db.orders.find((o) => o.id === r.orderId) : null;
  const item = order
    ? db.orderItems.find(
        (it) =>
          it.orderId === order.id &&
          db.productVariants.find((v) => v.id === it.variantId)?.productId === r.productId,
      )
    : null;
  const extra = db.reviewExtras.find((e) => e.reviewId === r.id);
  const primary = db.productImages.find((i) => i.productId === product.id && i.isPrimary);
  const delivered = order ? db.shipments.find((s) => s.orderId === order.id)?.deliveredAt : null;
  return {
    ...r,
    userName: user?.fullName ?? 'Khách hàng',
    userAvatarUrl: user ? mediaPath(db, user.avatarMediaId) : null,
    productName: product.name,
    productSlug: product.slug,
    productImageUrl: mediaPath(db, primary?.mediaId),
    variantLabel: item ? variantLabel(db, item.variantId) : null,
    orderCode: order?.orderCode ?? null,
    purchasedAt: delivered ?? order?.createdAt ?? null,
    images: extra?.images ?? [],
    tags: extra?.tags ?? [],
  };
}

// ---------------- Người dùng ----------------
export function userStats(db: Db, userId: number) {
  const os = db.orders.filter((o) => o.userId === userId);
  const counted = os.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  return {
    totalOrders: os.length,
    totalSpent: counted.reduce((s, o) => s + o.total, 0),
    lastOrderAt:
      os
        .map((o) => o.createdAt)
        .sort()
        .slice(-1)[0] ?? null,
  };
}

export function userView(db: Db, u: Db['users'][number]): UserView {
  const profile = db.userProfiles.find((p) => p.userId === u.id);
  const stats = userStats(db, u.id);
  const roleCodes = db.userRoles
    .filter((r) => r.userId === u.id)
    .map((r) => db.roles.find((x) => x.id === r.roleId)!.code as 'admin' | 'user');
  const spent = stats.totalSpent;
  return {
    ...u,
    roles: roleCodes,
    avatarUrl: mediaPath(db, u.avatarMediaId),
    gender: profile?.gender ?? null,
    birthday: profile?.birthday ?? null,
    customerGroup: stats.totalOrders >= 4 || spent >= 30_000_000 ? 'loyal' : 'new',
    loyaltyPoints: Math.floor(spent / 10_000),
    adminNote: profile?.adminNote ?? null,
    ...stats,
  };
}

export function addressView(db: Db, a: Db['addresses'][number]): AddressView {
  return { ...a, label: db.addressLabels[a.id] ?? 'Địa chỉ khác' };
}

// ---------------- Đơn hàng ----------------
export function orderView(db: Db, o: Db['orders'][number], opts: { customer?: boolean } = {}): OrderView {
  const items = db.orderItems
    .filter((it) => it.orderId === o.id)
    .map((it) => {
      const v = db.productVariants.find((x) => x.id === it.variantId);
      const p = v ? db.products.find((x) => x.id === v.productId) : null;
      const variantImg = v ? variantViews(db, v.productId).find((x) => x.id === v.id)?.imageUrl : null;
      return {
        ...it,
        imageUrl: variantImg ?? null,
        productSlug: p?.slug ?? null,
        productId: p?.id ?? null,
        variantLabel: variantLabel(db, it.variantId),
        reviewed: Boolean(p && db.reviews.some((r) => r.orderId === o.id && r.productId === p.id)),
      };
    });
  const shipment = db.shipments.find((s) => s.orderId === o.id) ?? null;
  const user = db.users.find((u) => u.id === o.userId);
  const uv = user ? userView(db, user) : null;
  const delivered = shipment?.deliveredAt ?? null;
  const coupon = o.couponId ? db.coupons.find((c) => c.id === o.couponId) : null;
  return {
    ...o,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    history: db.orderStatusHistory
      .filter((h) => h.orderId === o.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((h) => ({
        ...h,
        actorName:
          h.changedBy === null
            ? 'Hệ thống'
            : h.changedBy === 1
              ? 'Admin'
              : (db.users.find((u) => u.id === h.changedBy)?.fullName ?? 'Khách hàng'),
      })),
    payment: db.payments.find((p) => p.orderId === o.id) ?? null,
    shipment,
    couponCode: coupon?.code ?? null,
    customer:
      opts.customer && user && uv
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            avatarUrl: uv.avatarUrl,
            totalOrders: uv.totalOrders,
            customerGroup: uv.customerGroup,
          }
        : null,
    internalNote: db.orderNotes[o.id] ?? null,
    deliveredAt: delivered,
    canReturnUntil:
      o.status === 'completed' && delivered
        ? new Date(new Date(delivered).getTime() + RETURN_WINDOW_DAYS * 86_400_000).toISOString()
        : null,
  };
}

// ---------------- Coupon & giỏ hàng ----------------
export function couponView(db: Db, c: Db['coupons'][number]): CouponView {
  const ex = db.couponExtras.find((e) => e.couponId === c.id)!;
  return {
    ...c,
    name: ex.name,
    description: ex.description,
    appliesTo: ex.appliesTo,
    appliesToLabel: ex.appliesToLabel,
    kind: ex.kind,
  };
}

export function userCouponView(db: Db, uc: Db['userCoupons'][number]): UserCouponView {
  const c = db.coupons.find((x) => x.id === uc.couponId)!;
  let status = uc.status;
  if (status === 'unused' && c.endsAt && new Date(c.endsAt) < now()) status = 'expired';
  return {
    id: uc.id,
    couponId: uc.couponId,
    userId: uc.userId,
    status,
    savedAt: uc.savedAt,
    coupon: couponView(db, c),
  };
}

interface CalcLine {
  productId: number;
  categoryId: number | null;
  lineTotal: number;
}

/** Kiểm tra mã + tính số tiền giảm (D-N16: chỉ xem trước; đặt hàng sẽ kiểm tra lại) */
export function evaluateCoupon(
  db: Db,
  code: string,
  userId: number,
  lines: CalcLine[],
  subtotal: number,
  shippingFee: number,
) {
  const c = db.coupons.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
  if (!c) throw new ApiFail('COUPON_INVALID', 'Mã giảm giá không tồn tại.');
  const ex = db.couponExtras.find((e) => e.couponId === c.id)!;
  const t = now();
  if (!c.isActive) throw new ApiFail('COUPON_INVALID', 'Mã giảm giá đã bị vô hiệu hóa.');
  if (new Date(c.startsAt) > t)
    throw new ApiFail('COUPON_INVALID', 'Mã giảm giá chưa đến thời gian áp dụng.');
  if (c.endsAt && new Date(c.endsAt) < t) throw new ApiFail('COUPON_INVALID', 'Mã giảm giá đã hết hạn.');
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit)
    throw new ApiFail('COUPON_INVALID', 'Mã giảm giá đã hết lượt sử dụng.');
  const usedByUser = db.couponUsages.filter((u) => u.couponId === c.id && u.userId === userId).length;
  if (c.perUserLimit !== null && usedByUser >= c.perUserLimit)
    throw new ApiFail('COUPON_INVALID', 'Bạn đã dùng hết lượt cho mã giảm giá này.');
  if (subtotal < c.minOrderValue)
    throw new ApiFail(
      'COUPON_INVALID',
      `Đơn hàng cần tối thiểu ${c.minOrderValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ để dùng mã này.`,
    );
  let base = subtotal;
  if (ex.categoryIds.length) {
    const scoped = lines.filter(
      (l) =>
        l.categoryId !== null &&
        (ex.categoryIds.includes(l.categoryId) ||
          ex.categoryIds.includes(db.categories.find((x) => x.id === l.categoryId)?.parentId ?? -1)),
    );
    if (!scoped.length)
      throw new ApiFail('COUPON_INVALID', 'Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng.');
    base = scoped.reduce((s, l) => s + l.lineTotal, 0);
  }
  const discount =
    ex.kind === 'percent'
      ? Math.min(Math.floor((base * c.value) / 100), c.maxDiscount ?? Infinity)
      : ex.kind === 'fixed'
        ? Math.min(c.value, base)
        : shippingFee;
  return { coupon: c, extra: ex, discount };
}

export function shippingFeeFor(db: Db, userId: number, subtotal: number, addressId?: number | null): number {
  const zones = db.settings.find((s) => s.key === 'shippingZones')?.value as
    Array<{ name: string; fee: number; freeFrom: number }> | undefined;
  const addr =
    (addressId ? db.addresses.find((a) => a.id === addressId) : null) ??
    db.addresses.find((a) => a.userId === userId && a.isDefault);
  const zone = zones?.find((z) => z.name === addr?.province);
  const fee = zone?.fee ?? DEFAULT_SHIP_FEE;
  const freeFrom = zone?.freeFrom ?? FREE_SHIP_FROM;
  return subtotal >= freeFrom ? 0 : fee;
}

export function cartLines(db: Db, userId: number) {
  const cart = db.carts.find((c) => c.userId === userId);
  const items = cart ? db.cartItems.filter((i) => i.cartId === cart.id) : [];
  return { cart, items };
}

export function cartView(db: Db, userId: number): CartView {
  const { cart, items } = cartLines(db, userId);
  const views: CartItemView[] = [];
  for (const it of items) {
    const v = db.productVariants.find((x) => x.id === it.variantId);
    const p = v ? db.products.find((x) => x.id === v.productId) : null;
    if (!v || !p) continue;
    const vv = variantViews(db, p.id).find((x) => x.id === v.id);
    views.push({
      ...it,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      imageUrl: vv?.imageUrl ?? null,
      sku: v.sku,
      variantLabel: variantLabel(db, v.id),
      unitPrice: effectivePrice(v),
      originalPrice: v.price,
      lineTotal: effectivePrice(v) * it.quantity,
      stockQuantity: v.stockQuantity,
    });
  }
  const subtotal = views.reduce((s, i) => s + i.lineTotal, 0);
  const shippingFee = views.length ? shippingFeeFor(db, userId, subtotal) : 0;
  let discountAmount = 0;
  let coupon: CartView['coupon'] = null;
  const code = db.cartCoupons[userId];
  if (code && views.length) {
    try {
      const r = evaluateCoupon(
        db,
        code,
        userId,
        views.map((v) => ({
          productId: v.productId,
          categoryId: db.products.find((p) => p.id === v.productId)?.categoryId ?? null,
          lineTotal: v.lineTotal,
        })),
        subtotal,
        shippingFee,
      );
      discountAmount = r.discount;
      coupon = {
        id: r.coupon.id,
        code: r.coupon.code,
        type: r.extra.kind === 'freeship' ? 'freeship' : r.coupon.type,
        value: r.coupon.value,
      };
    } catch {
      delete db.cartCoupons[userId]; // mã không còn hợp lệ → gỡ khỏi giỏ
    }
  }
  return {
    id: cart?.id ?? 0,
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

// ---------------- Thông báo ----------------
export function notificationView(n: Db['notifications'][number]): NotificationView {
  const d = n.data as unknown as { type?: string; content?: string; link?: string | null };
  return {
    ...n,
    data: {
      type: (d.type as 'order' | 'promo' | 'system') ?? 'system',
      content: d.content ?? '',
      link: d.link ?? null,
    },
  };
}

// ---------------- Không gian mẫu ----------------
function spaceProductIds(db: Db, spaceId: number): number[] {
  const pans = db.spacePanoramas.filter((p) => p.spaceId === spaceId).map((p) => p.id);
  return [
    ...new Set(
      db.spaceHotspots
        .filter((h) => pans.includes(h.panoramaId) && h.type === 'product' && h.productId)
        .map((h) => h.productId!),
    ),
  ];
}

export function spaceListItem(db: Db, s: Db['spaces'][number], userId?: number | null): SpaceListItem {
  return {
    ...s,
    coverUrl: mediaPath(db, s.coverMediaId),
    productCount: spaceProductIds(db, s.id).length,
    panoramaCount: db.spacePanoramas.filter((p) => p.spaceId === s.id).length,
    isBookmarked: userId ? db.spaceBookmarks.some((b) => b.spaceId === s.id && b.userId === userId) : false,
  };
}

export function spaceDetail(db: Db, s: Db['spaces'][number], userId?: number | null): SpaceDetail {
  const base = spaceListItem(db, s, userId);
  const panoramas: PanoramaView[] = db.spacePanoramas
    .filter((p) => p.spaceId === s.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({
      ...p,
      url: mediaPath(db, p.mediaId) ?? '',
      hotspots: db.spaceHotspots
        .filter((h) => h.panoramaId === p.id)
        .map((h) => {
          const prod = h.productId ? db.products.find((x) => x.id === h.productId) : null;
          const li = prod ? productListItem(db, prod, userId) : null;
          return {
            ...h,
            product: li
              ? {
                  id: li.id,
                  name: li.name,
                  slug: li.slug,
                  price: li.price,
                  salePrice: li.salePrice,
                  thumbnailUrl: li.thumbnailUrl,
                  defaultVariantId: li.defaultVariantId,
                }
              : null,
          };
        }),
      placements: db.spaceProductPlacements.filter((x) => x.panoramaId === p.id),
    }));
  const productsList = spaceProductIds(db, s.id).map((id) =>
    productListItem(
      db,
      db.products.find((p) => p.id === id)!,
      userId,
    ),
  );
  const originalTotal = productsList.reduce((sum, p) => sum + (p.salePrice ?? p.price), 0);
  const similar = db.spaces
    .filter(
      (x) => x.id !== s.id && x.status === 'published' && (x.roomType === s.roomType || x.style === s.style),
    )
    .slice(0, 4)
    .map((x) => spaceListItem(db, x, userId));
  return {
    ...base,
    panoramas,
    products: productsList,
    originalTotal,
    comboTotal: Math.round((originalTotal * (100 - COMBO_DISCOUNT_PERCENT)) / 100 / 1000) * 1000,
    comboDiscountPercent: COMBO_DISCOUNT_PERCENT,
    similar,
  };
}

export const MOCK_TODAY = MOCK_NOW;
