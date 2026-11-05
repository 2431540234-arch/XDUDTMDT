// Mock API: danh mục, sản phẩm, đánh giá, hỏi đáp, yêu thích, không gian mẫu, nội dung công khai, thông báo
import type { Product } from '@aurelia-living/shared-types';
import type { ProductFacets } from '@/types/api';
import { nextId, type Db } from '../db';
import {
  ApiFail,
  created,
  done,
  fold,
  nowIso,
  notFound,
  ok,
  paginate,
  qBool,
  qList,
  qNum,
  qStr,
  sortBy,
  validation,
  type Ctx,
  type Query,
  type Result,
} from './http';
import {
  categoryIdsWithChildren,
  categoryTree,
  colorOfVariant,
  couponView,
  effectivePrice,
  mediaPath,
  model3DView,
  notificationView,
  productDetail,
  productListItem,
  reviewView,
  spaceDetail,
  spaceListItem,
  userCouponView,
} from './views';

export const categories = (ctx: Ctx): Result => ok(categoryTree(ctx.db));
export const brands = (ctx: Ctx): Result =>
  ok(ctx.db.brands.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, slug: b.slug })));

// ---------------- Sản phẩm ----------------
function visibleProducts(db: Db): Product[] {
  return db.products.filter((p) => p.status === 'published' && !p.deletedAt);
}

function matchesQuery(db: Db, p: Product, q: string): number {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const cat = db.categories.find((c) => c.id === p.categoryId);
  const style = db.productExtras.find((e) => e.productId === p.id)?.style ?? '';
  const hay = fold(`${p.name} ${cat?.name ?? ''} ${style} ${p.shortDescription ?? ''}`);
  const nameFold = fold(p.name);
  let score = 0;
  for (const t of terms) {
    if (!hay.includes(t)) return 0;
    score += nameFold.includes(t) ? 3 : 1;
    if (nameFold.startsWith(t)) score += 2;
  }
  return score;
}

export function filterProducts(ctx: Ctx, q: Query, opts: { ignoreCategory?: boolean } = {}) {
  const db = ctx.db;
  const search = qStr(q, 'q');
  const cats = qList(q, 'category');
  const catIds = new Set(cats.flatMap((s) => categoryIdsWithChildren(db, s)));
  const colors = qList(q, 'color').map(fold);
  const materials = qList(q, 'material').map(fold);
  const styles = qList(q, 'style').map(fold);
  const min = qNum(q, 'minPrice', -1);
  const max = qNum(q, 'maxPrice', -1);
  const has3d = qBool(q, 'has3d');
  const hasAr = qBool(q, 'hasAr');
  const featured = qBool(q, 'featured');
  const brand = qStr(q, 'brand');
  const scored: Array<{ p: Product; score: number }> = [];
  for (const p of visibleProducts(db)) {
    const score = matchesQuery(db, p, search);
    if (!score) continue;
    if (!opts.ignoreCategory && catIds.size && !(p.categoryId && catIds.has(p.categoryId))) continue;
    if (brand && String(p.brandId) !== brand) continue;
    if (has3d !== undefined && p.has3dModel !== has3d) continue;
    if (hasAr !== undefined && p.hasAr !== hasAr) continue;
    if (featured !== undefined && p.isFeatured !== featured) continue;
    const li = productListItem(db, p);
    const price = li.salePrice ?? li.price;
    if (min >= 0 && price < min) continue;
    if (max >= 0 && price >= max && max > 0) continue;
    if (colors.length && !li.colors.some((c) => colors.includes(fold(c.name)))) continue;
    if (materials.length && !(li.material && materials.includes(fold(li.material)))) continue;
    if (styles.length && !(li.style && styles.includes(fold(li.style)))) continue;
    scored.push({ p, score });
  }
  return scored;
}

function listProducts(ctx: Ctx, defaultSort: string): Result {
  const q = ctx.query;
  const scored = filterProducts(ctx, q);
  const sort = qStr(q, 'sort') || defaultSort;
  const userId = ctx.user?.id ?? null;
  let items = scored.map((s) => ({ ...productListItem(ctx.db, s.p, userId), _score: s.score }));
  if (sort === 'relevance') items.sort((a, b) => b._score - a._score || b.soldCount - a.soldCount);
  else
    items = sortBy(
      items,
      sort,
      {
        createdAt: (x) => x.createdAt,
        price: (x) => x.salePrice ?? x.price,
        soldCount: (x) => x.soldCount,
        ratingAvg: (x) => x.ratingAvg,
        name: (x) => x.name,
      },
      'createdAt:desc',
    );
  return paginate(
    items.map(({ _score, ...rest }) => (void _score, rest)),
    q,
    12,
  );
}

export const products = (ctx: Ctx): Result => listProducts(ctx, 'createdAt:desc');
export const searchProducts = (ctx: Ctx): Result => listProducts(ctx, 'relevance');

export function facets(ctx: Ctx): Result {
  const db = ctx.db;
  const scored = filterProducts(
    ctx,
    { q: ctx.query.q, category: ctx.query.category },
    { ignoreCategory: !qStr(ctx.query, 'category') },
  );
  const items = scored.map((s) => productListItem(db, s.p));
  const catCount = new Map<string, number>();
  const colorCount = new Map<string, { hex: string; count: number }>();
  const matCount = new Map<string, number>();
  const styleCount = new Map<string, number>();
  for (const it of items) {
    if (it.category) catCount.set(it.category.slug, (catCount.get(it.category.slug) ?? 0) + 1);
    for (const c of it.colors)
      colorCount.set(c.name, { hex: c.hex, count: (colorCount.get(c.name)?.count ?? 0) + 1 });
    if (it.material) matCount.set(it.material, (matCount.get(it.material) ?? 0) + 1);
    if (it.style) styleCount.set(it.style, (styleCount.get(it.style) ?? 0) + 1);
  }
  const out: ProductFacets = {
    categories: [...catCount.entries()]
      .map(([slug, count]) => ({ slug, name: db.categories.find((c) => c.slug === slug)!.name, count }))
      .sort((a, b) => b.count - a.count),
    colors: [...colorCount.entries()]
      .map(([name, v]) => ({ name, hex: v.hex, count: v.count }))
      .sort((a, b) => b.count - a.count),
    materials: [...matCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    styles: [...styleCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
  };
  return ok(out);
}

function productBySlug(ctx: Ctx): Product {
  const p = visibleProducts(ctx.db).find((x) => x.slug === ctx.params.slug);
  if (!p) throw notFound('Sản phẩm');
  return p;
}

export const productDetailHandler = (ctx: Ctx): Result =>
  ok(productDetail(ctx.db, productBySlug(ctx), ctx.user?.id));

export function productModel(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  const m = ctx.db.product3dModels.find((x) => x.productId === p.id && x.isPrimary && x.status === 'ready');
  return ok(m ? model3DView(ctx.db, m) : null);
}

export function relatedProducts(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  const same = visibleProducts(ctx.db).filter((x) => x.id !== p.id && x.categoryId === p.categoryId);
  const rest = visibleProducts(ctx.db).filter(
    (x) =>
      x.id !== p.id &&
      x.categoryId !== p.categoryId &&
      ctx.db.categories.find((c) => c.id === x.categoryId)?.parentId ===
        ctx.db.categories.find((c) => c.id === p.categoryId)?.parentId,
  );
  return ok([...same, ...rest].slice(0, 4).map((x) => productListItem(ctx.db, x, ctx.user?.id)));
}

// ---------------- Đánh giá ----------------
export function productReviews(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  const rating = qNum(ctx.query, 'rating', 0);
  const list = ctx.db.reviews
    .filter((r) => r.productId === p.id && r.status === 'approved' && (!rating || r.rating === rating))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => reviewView(ctx.db, r));
  return paginate(list, ctx.query, 5);
}

export function createReview(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  const rating = Number(b.rating);
  if (!(rating >= 1 && rating <= 5)) errs.rating = 'Vui lòng chọn số sao.';
  if (String(b.content ?? '').trim().length < 20) errs.content = 'Nội dung đánh giá tối thiểu 20 ký tự.';
  if (String(b.content ?? '').length > 1000) errs.content = 'Nội dung đánh giá tối đa 1000 ký tự.';
  if (Object.keys(errs).length) throw validation(errs);
  const order = ctx.db.orders.find(
    (o) => o.id === Number(b.orderId) && o.userId === ctx.user!.id && o.status === 'completed',
  );
  const bought =
    order &&
    ctx.db.orderItems.some(
      (it) =>
        it.orderId === order.id &&
        ctx.db.productVariants.find((v) => v.id === it.variantId)?.productId === p.id,
    );
  if (!bought)
    throw new ApiFail('PURCHASE_REQUIRED', 'Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng.');
  if (ctx.db.reviews.some((r) => r.userId === ctx.user!.id && r.productId === p.id && r.orderId === order.id))
    throw new ApiFail('CONFLICT', 'Bạn đã đánh giá sản phẩm này rồi.');
  const id = nextId(ctx.db.reviews);
  const at = nowIso();
  const row = {
    id,
    userId: ctx.user!.id,
    productId: p.id,
    orderId: order.id,
    rating,
    content: String(b.content).trim(),
    status: 'pending' as const,
    createdAt: at,
    updatedAt: at,
  };
  ctx.db.reviews.push(row);
  ctx.db.reviewExtras.push({
    reviewId: id,
    tags: Array.isArray(b.tags) ? b.tags : [],
    images: Array.isArray(b.images) ? b.images : [],
  });
  ctx.db.activityLogs.push({
    id: nextId(ctx.db.activityLogs),
    actorId: ctx.user!.id,
    action: 'review.create',
    targetType: 'review',
    targetId: id,
    changes: { rating },
    ipAddress: '127.0.0.1',
    createdAt: at,
  });
  return created(reviewView(ctx.db, row));
}

export const myReviews = (ctx: Ctx): Result =>
  ok(
    ctx.db.reviews
      .filter((r) => r.userId === ctx.user!.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => reviewView(ctx.db, r)),
  );

function ownReview(ctx: Ctx) {
  const r = ctx.db.reviews.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user!.id);
  if (!r) throw notFound('Đánh giá');
  return r;
}

export function updateReview(ctx: Ctx): Result {
  const r = ownReview(ctx);
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (b.rating !== undefined && !(Number(b.rating) >= 1 && Number(b.rating) <= 5))
    errs.rating = 'Vui lòng chọn số sao.';
  if (b.content !== undefined && String(b.content).trim().length < 20)
    errs.content = 'Nội dung đánh giá tối thiểu 20 ký tự.';
  if (Object.keys(errs).length) throw validation(errs);
  if (b.rating !== undefined) r.rating = Number(b.rating);
  if (b.content !== undefined) r.content = String(b.content).trim();
  const ex = ctx.db.reviewExtras.find((e) => e.reviewId === r.id);
  if (ex && Array.isArray(b.tags)) ex.tags = b.tags;
  r.status = 'pending'; // sửa xong phải được duyệt lại
  r.updatedAt = nowIso();
  return ok(reviewView(ctx.db, r));
}

export function deleteReview(ctx: Ctx): Result {
  const r = ownReview(ctx);
  ctx.db.reviews.splice(ctx.db.reviews.indexOf(r), 1);
  return done();
}

// ---------------- Hỏi đáp ----------------
export function productQuestions(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  return ok(
    ctx.db.productQuestions
      .filter((q) => q.productId === p.id && q.status === 'answered' && q.isPublic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function askQuestion(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  const content = String(ctx.body?.content ?? '').trim();
  if (content.length < 10) throw validation({ content: 'Câu hỏi tối thiểu 10 ký tự.' });
  const id = nextId(ctx.db.productQuestions);
  const row = {
    id,
    productId: p.id,
    productName: p.name,
    productSlug: p.slug,
    productImageUrl: mediaPath(
      ctx.db,
      ctx.db.productImages.find((i) => i.productId === p.id && i.isPrimary)?.mediaId,
    ),
    userId: ctx.user!.id,
    userName: ctx.user!.fullName,
    content,
    answer: null,
    answeredBy: null,
    answeredAt: null,
    isPublic: true,
    status: 'unanswered' as const,
    createdAt: nowIso(),
  };
  ctx.db.productQuestions.push(row);
  return created(row);
}

// ---------------- Yêu thích ----------------
export const wishlist = (ctx: Ctx): Result =>
  ok(
    ctx.db.wishlists
      .filter((w) => w.userId === ctx.user!.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((w) => ctx.db.products.find((p) => p.id === w.productId))
      .filter((p): p is Product => Boolean(p))
      .map((p) => productListItem(ctx.db, p, ctx.user!.id)),
  );

export function addWishlist(ctx: Ctx): Result {
  const p = productBySlug(ctx);
  if (!ctx.db.wishlists.some((w) => w.userId === ctx.user!.id && w.productId === p.id))
    ctx.db.wishlists.push({
      id: nextId(ctx.db.wishlists),
      userId: ctx.user!.id,
      productId: p.id,
      createdAt: nowIso(),
    });
  return done();
}

export function removeWishlist(ctx: Ctx): Result {
  const p = ctx.db.products.find((x) => x.slug === ctx.params.slug);
  if (p)
    ctx.db.wishlists = ctx.db.wishlists.filter((w) => !(w.userId === ctx.user!.id && w.productId === p.id));
  return done();
}

// ---------------- Không gian mẫu ----------------
export function spaces(ctx: Ctx): Result {
  const q = ctx.query;
  const search = fold(qStr(q, 'q'));
  const room = qStr(q, 'roomType');
  const style = qStr(q, 'style');
  const only = qBool(q, 'bookmarked');
  let list = ctx.db.spaces.filter((s) => s.status === 'published');
  if (search)
    list = list.filter((s) => fold(`${s.title} ${s.style ?? ''} ${s.description ?? ''}`).includes(search));
  if (room) list = list.filter((s) => s.roomType === room);
  if (style) list = list.filter((s) => s.style === style);
  let items = list.map((s) => spaceListItem(ctx.db, s, ctx.user?.id));
  if (only) items = items.filter((s) => s.isBookmarked);
  const sort = qStr(q, 'sort') || 'newest';
  items =
    sort === 'popular'
      ? items.sort((a, b) => b.viewCount - a.viewCount)
      : sort === 'title'
        ? items.sort((a, b) => a.title.localeCompare(b.title, 'vi'))
        : items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  return paginate(items, q, 12);
}

export function spaceFacets(ctx: Ctx): Result {
  const pub = ctx.db.spaces.filter((s) => s.status === 'published');
  const count = <T extends string>(f: (s: (typeof pub)[number]) => T | null) => {
    const m = new Map<T, number>();
    pub.forEach((s) => {
      const k = f(s);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()];
  };
  return ok({
    styles: count((s) => s.style).map(([value, c]) => ({ value, count: c })),
    roomTypes: count((s) => s.roomType).map(([value, c]) => ({ value, count: c })),
  });
}

export function spaceBySlug(ctx: Ctx): Result {
  const s = ctx.db.spaces.find((x) => x.slug === ctx.params.slug && x.status === 'published');
  if (!s) throw notFound('Không gian mẫu');
  s.viewCount += 1;
  return ok(spaceDetail(ctx.db, s, ctx.user?.id));
}

export function bookmarkSpace(ctx: Ctx): Result {
  const s = ctx.db.spaces.find((x) => x.slug === ctx.params.slug);
  if (!s) throw notFound('Không gian mẫu');
  if (!ctx.db.spaceBookmarks.some((b) => b.spaceId === s.id && b.userId === ctx.user!.id))
    ctx.db.spaceBookmarks.push({
      id: nextId(ctx.db.spaceBookmarks),
      userId: ctx.user!.id,
      spaceId: s.id,
      createdAt: nowIso(),
    });
  return done();
}

export function unbookmarkSpace(ctx: Ctx): Result {
  const s = ctx.db.spaces.find((x) => x.slug === ctx.params.slug);
  if (s)
    ctx.db.spaceBookmarks = ctx.db.spaceBookmarks.filter(
      (b) => !(b.spaceId === s.id && b.userId === ctx.user!.id),
    );
  return done();
}

// ---------------- Nội dung công khai ----------------
export function banners(ctx: Ctx): Result {
  const t = new Date();
  return ok(
    ctx.db.banners
      .filter((b) => b.isActive && new Date(b.startAt) <= t && (!b.endAt || new Date(b.endAt) >= t))
      .sort((a, b) => a.position.localeCompare(b.position) || a.sortOrder - b.sortOrder),
  );
}

export const posts = (ctx: Ctx): Result =>
  ok(
    ctx.db.posts
      .filter((p) => p.status === 'published')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
  );

export function pageBySlug(ctx: Ctx): Result {
  const p = ctx.db.pages.find((x) => x.slug === ctx.params.slug && x.status === 'published');
  if (!p) throw notFound('Trang');
  return ok(p);
}

export const policies = (ctx: Ctx): Result =>
  ok(
    ctx.db.pages
      .filter((p) => p.slug.startsWith('chinh-sach') || p.slug.startsWith('dieu-khoan'))
      .map((p) => ({ slug: p.slug, title: p.title })),
  );
export const faq = (ctx: Ctx): Result => ok(ctx.db.faqTopics);

export function contact(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (String(b.fullName ?? '').trim().length < 2) errs.fullName = 'Vui lòng nhập họ và tên.';
  if (!/^0\d{9}$/.test(String(b.phone ?? ''))) errs.phone = 'Số điện thoại phải gồm 10 chữ số.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email ?? ''))) errs.email = 'Email không hợp lệ.';
  if (!String(b.subject ?? '')) errs.subject = 'Vui lòng chọn chủ đề.';
  if (String(b.content ?? '').trim().length < 10) errs.content = 'Nội dung tối thiểu 10 ký tự.';
  if (Object.keys(errs).length) throw validation(errs);
  ctx.db.contactMessages.push({
    id: nextId(ctx.db.contactMessages),
    fullName: b.fullName,
    phone: b.phone,
    email: b.email,
    subject: b.subject,
    content: b.content,
    createdAt: nowIso(),
  });
  return created(null);
}

export const publicSettings = (ctx: Ctx): Result => ok(settingsView(ctx.db));

export function settingsView(db: Db) {
  const get = <T>(key: string) => db.settings.find((s) => s.key === key)!.value as T;
  return {
    store: get<Record<string, unknown>>('store'),
    payments: get<unknown[]>('payments'),
    shippingZones: get<unknown[]>('shippingZones'),
  };
}

// ---------------- Thông báo ----------------
export function notifications(ctx: Ctx): Result {
  const type = qStr(ctx.query, 'type');
  const list = ctx.db.notifications
    .filter((n) => n.userId === ctx.user!.id)
    .map(notificationView)
    .filter((n) => !type || n.data.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(list, ctx.query, 10);
}

export const unreadCount = (ctx: Ctx): Result =>
  ok({ count: ctx.db.notifications.filter((n) => n.userId === ctx.user!.id && !n.readAt).length });

export function markRead(ctx: Ctx): Result {
  const n = ctx.db.notifications.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user!.id);
  if (!n) throw notFound('Thông báo');
  n.readAt ??= nowIso();
  return ok(notificationView(n));
}

export function markAllRead(ctx: Ctx): Result {
  ctx.db.notifications
    .filter((n) => n.userId === ctx.user!.id && !n.readAt)
    .forEach((n) => (n.readAt = nowIso()));
  return done();
}

// ---------------- Mã giảm giá của tôi ----------------
export function myCoupons(ctx: Ctx): Result {
  const status = qStr(ctx.query, 'status');
  return ok(
    ctx.db.userCoupons
      .filter((u) => u.userId === ctx.user!.id)
      .map((u) => userCouponView(ctx.db, u))
      .filter((u) => !status || u.status === status),
  );
}

export function suggestedCoupons(ctx: Ctx): Result {
  const have = new Set(ctx.db.userCoupons.filter((u) => u.userId === ctx.user!.id).map((u) => u.couponId));
  const t = new Date();
  return ok(
    ctx.db.coupons
      .filter(
        (c) =>
          c.isActive &&
          !have.has(c.id) &&
          new Date(c.startsAt) <= t &&
          (!c.endsAt || new Date(c.endsAt) >= t),
      )
      .slice(0, 4)
      .map((c) => couponView(ctx.db, c)),
  );
}

export function saveCoupon(ctx: Ctx): Result {
  const code = String(ctx.body?.code ?? '').trim();
  if (!code) throw validation({ code: 'Vui lòng nhập mã giảm giá.' });
  const c = ctx.db.coupons.find((x) => x.code.toLowerCase() === code.toLowerCase());
  if (!c) throw new ApiFail('COUPON_INVALID', 'Mã giảm giá không tồn tại.');
  if (!c.isActive || (c.endsAt && new Date(c.endsAt) < new Date()))
    throw new ApiFail('COUPON_INVALID', 'Mã giảm giá đã hết hạn.');
  if (ctx.db.userCoupons.some((u) => u.userId === ctx.user!.id && u.couponId === c.id))
    throw new ApiFail('CONFLICT', 'Bạn đã lưu mã giảm giá này rồi.');
  const row = {
    id: nextId(ctx.db.userCoupons),
    userId: ctx.user!.id,
    couponId: c.id,
    status: 'unused' as const,
    savedAt: nowIso(),
  };
  ctx.db.userCoupons.push(row);
  return created(userCouponView(ctx.db, row));
}

void colorOfVariant;
void effectivePrice;
