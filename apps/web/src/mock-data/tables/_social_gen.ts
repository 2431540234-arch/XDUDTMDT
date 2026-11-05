// Sinh: reviews, product_questions, return_requests, user_coupons, notifications, activity_logs, wishlists, carts, cart_items
import type {
  ActivityLog,
  Cart,
  CartItem,
  Notification,
  Review,
  ReviewStatus,
  Wishlist,
} from '@aurelia-living/shared-types';
import type { ProductQuestion, ReturnRequest } from '@/types/api';
import { productImg } from '../utils/img';
import { addDays, addHours, iso, makeRng, MOCK_NOW } from '../utils/rng';
import {
  answerTexts,
  questionTexts,
  reviewNegative,
  reviewNeutral,
  reviewPositive,
  reviewTags,
} from '../utils/vi';
import { COLORS } from './attributes';
import { couponExtras, coupons } from './coupons';
import { deliveredAtByOrder, orderItems, orders } from './_orders_gen';
import { productExtras, productVariants, products } from './_products_gen';
import { ADMIN_ID, TEST_CUSTOMER_ID, users } from './users';

const rng = makeRng(606);

// ---------------- Đánh giá ----------------
export interface ReviewExtra {
  reviewId: number;
  images: string[]; // TODO: chưa có trong DB
  tags: string[]; // TODO: chưa có trong DB
}

export const reviews: Review[] = [];
export const reviewExtras: ReviewExtra[] = [];
const reviewed = new Set<string>();

const completedOrders = orders.filter((o) => o.status === 'completed');
const lineJobs: Array<{ orderId: number; userId: number; productId: number; at: Date }> = [];
for (const o of completedOrders) {
  const delivered = new Date(deliveredAtByOrder.get(o.id) ?? o.updatedAt);
  for (const it of orderItems.filter((x) => x.orderId === o.id)) {
    const v = productVariants.find((x) => x.id === it.variantId)!;
    lineJobs.push({ orderId: o.id, userId: o.userId, productId: v.productId, at: delivered });
  }
}
// đơn mới giao gần đây của khách test: chưa đánh giá (để demo nút "Đánh giá sản phẩm")
const testRecent = completedOrders
  .filter((o) => o.userId === TEST_CUSTOMER_ID)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

for (const job of rng.shuffle(lineJobs)) {
  if (testRecent && job.orderId === testRecent.id) continue;
  const key = `${job.userId}:${job.productId}`;
  if (reviewed.has(key) || !rng.chance(0.93)) continue;
  reviewed.add(key);
  const at = addDays(job.at, rng.int(1, 14));
  if (at > MOCK_NOW) continue;
  const roll = rng.next();
  const rating = roll < 0.55 ? 5 : roll < 0.83 ? 4 : roll < 0.93 ? 3 : roll < 0.97 ? 2 : 1;
  const sroll = rng.next();
  const status: ReviewStatus = sroll < 0.82 ? 'approved' : sroll < 0.9 ? 'pending' : 'rejected';
  const content =
    rating >= 4
      ? rng.pick(reviewPositive)
      : rating === 3
        ? rng.pick(reviewNeutral)
        : rng.pick(reviewNegative);
  const id = reviews.length + 1;
  reviews.push({
    id,
    userId: job.userId,
    productId: job.productId,
    orderId: job.orderId,
    rating,
    content,
    status,
    createdAt: iso(at),
    updatedAt: iso(at),
  });
  const p = products.find((x) => x.id === job.productId)!;
  const ex = productExtras.find((x) => x.productId === p.id)!;
  const nImg = rng.chance(0.35) ? rng.int(1, 4) : 0;
  reviewExtras.push({
    reviewId: id,
    tags: rating >= 4 ? rng.sample(reviewTags, rng.int(1, 3)) : [],
    images: Array.from({ length: nImg }, (_, k) => productImg(ex.type, rng.pick(COLORS).hex, 4 + (k % 2))),
  });
}
// Bảo đảm tối thiểu 80 đánh giá: bổ sung thêm đánh giá cho dòng hàng còn lại (khác đơn, cùng sản phẩm)
for (const job of lineJobs) {
  if (reviews.length >= 84) break;
  if (testRecent && job.orderId === testRecent.id) continue;
  const key = `${job.userId}:${job.productId}`;
  if (reviewed.has(key)) continue;
  reviewed.add(key);
  const at = addDays(job.at, rng.int(1, 10));
  if (at > MOCK_NOW) continue;
  const id = reviews.length + 1;
  reviews.push({
    id,
    userId: job.userId,
    productId: job.productId,
    orderId: job.orderId,
    rating: rng.pick([5, 5, 4, 4, 3]),
    content: rng.pick(reviewPositive),
    status: 'approved',
    createdAt: iso(at),
    updatedAt: iso(at),
  });
  reviewExtras.push({ reviewId: id, tags: rng.sample(reviewTags, 2), images: [] });
}
reviews.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const oldIds = reviews.map((r) => r.id);
const idMap = new Map(oldIds.map((oid, i) => [oid, i + 1]));
reviews.forEach((r, i) => (r.id = i + 1));
reviewExtras.forEach((e) => (e.reviewId = idMap.get(e.reviewId) ?? e.reviewId));

// ---------------- Hỏi đáp (chưa có trong DB) ----------------
export const productQuestions: ProductQuestion[] = [];
{
  const customers = users.filter((u) => u.id > 1 && u.status === 'active');
  for (let i = 0; i < 34; i++) {
    const p = rng.pick(products);
    const u = rng.pick(customers);
    const at = addDays(new Date('2026-02-01T08:00:00.000Z'), rng.int(0, 250));
    const state = i % 10 < 3 ? 'unanswered' : i % 10 === 9 ? 'hidden' : 'answered';
    productQuestions.push({
      id: i + 1,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      productImageUrl: null,
      userId: u.id,
      userName: u.fullName,
      content: questionTexts[i % questionTexts.length],
      answer: state === 'answered' ? answerTexts[i % answerTexts.length] : null,
      answeredBy: state === 'answered' ? 'Aurelia Living' : null,
      answeredAt: state === 'answered' ? iso(addHours(at, rng.int(2, 30))) : null,
      isPublic: state !== 'hidden',
      status: state,
      createdAt: iso(at),
    });
  }
  productQuestions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  productQuestions.forEach((q, i) => (q.id = i + 1));
}

// ---------------- Đổi trả (chưa có trong DB) ----------------
export const returnRequests: ReturnRequest[] = [];
{
  const reasons: ReturnRequest['reason'][] = [
    'defect',
    'wrong_item',
    'not_as_described',
    'missing_accessory',
    'change_mind',
  ];
  const reasonText: Record<ReturnRequest['reason'], string> = {
    defect: 'Sản phẩm bị lỗi/hư hỏng khi nhận hàng, có vết nứt ở chân.',
    wrong_item: 'Giao sai mẫu/màu so với đơn đặt hàng.',
    not_as_described: 'Sản phẩm không đúng mô tả, màu sắc khác nhiều so với ảnh.',
    missing_accessory: 'Thiếu phụ kiện lắp ráp (ốc vít, chân đế).',
    change_mind: 'Tôi đổi ý, không còn nhu cầu sử dụng.',
  };
  const statuses: ReturnRequest['status'][] = [
    'pending',
    'pending',
    'pending',
    'picking',
    'picking',
    'inspecting',
    'inspecting',
    'refunded',
    'refunded',
    'refunded',
    'exchanged',
    'rejected',
    'rejected',
  ];
  const pool = completedOrders
    .filter((o) => o.userId !== TEST_CUSTOMER_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 13);
  const testOld = completedOrders.find(
    (o) => o.userId === TEST_CUSTOMER_ID && o.createdAt.startsWith('2026-05'),
  );
  const picked = testOld ? [...pool.slice(0, 12), testOld] : pool;
  picked.forEach((o, i) => {
    const its = orderItems.filter((x) => x.orderId === o.id).slice(0, 1);
    const user = users.find((u) => u.id === o.userId)!;
    const delivered = new Date(deliveredAtByOrder.get(o.id) ?? o.updatedAt);
    const created = addDays(delivered, rng.int(1, 5));
    const status = o === testOld ? 'refunded' : statuses[i % statuses.length];
    const refund = its.reduce((s, x) => s + x.lineTotal!, 0);
    const reason = reasons[i % reasons.length];
    returnRequests.push({
      id: i + 1,
      code: `RT${String(12 + i).padStart(4, '0')}`,
      orderId: o.id,
      orderCode: o.orderCode,
      userId: user.id,
      customerName: user.fullName,
      items: its.map((x) => {
        const v = productVariants.find((y) => y.id === x.variantId)!;
        return {
          productId: v.productId,
          productName: x.productName,
          imageUrl: null,
          variantLabel: '',
          quantity: 1,
          unitPrice: x.unitPrice,
        };
      }),
      type: i % 4 === 3 ? 'exchange' : 'refund',
      reason,
      description: reasonText[reason],
      images: [productImg('sofa', 'C9B8A0', 3)],
      refundAmount: refund,
      status: i % 4 === 3 && status === 'refunded' ? 'exchanged' : status,
      adminNote:
        status === 'rejected' ? 'Sản phẩm đã qua sử dụng, không đủ điều kiện đổi trả theo chính sách.' : null,
      createdAt: iso(created),
      updatedAt: iso(addDays(created, 1)),
    });
  });
  returnRequests.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  returnRequests.forEach((r, i) => (r.id = i + 1));
}

// ---------------- Mã giảm giá của khách (chưa có bảng) ----------------
export interface UserCouponRow {
  id: number;
  userId: number;
  couponId: number;
  status: 'unused' | 'used' | 'expired';
  savedAt: string;
}
export const userCoupons: UserCouponRow[] = [];
{
  const code = (c: string) => coupons.find((x) => x.code === c)!.id;
  const plan: Array<[string, UserCouponRow['status']]> = [
    ['WELCOME10', 'used'],
    ['FREESHIP', 'unused'],
    ['NOITHAT20', 'unused'],
    ['GIAM200K', 'used'],
    ['GIAM500K', 'unused'],
    ['SOFA12', 'unused'],
    ['VIP20', 'used'],
    ['PHONGNGU150', 'unused'],
    ['NEWYEAR2026', 'expired'],
  ];
  plan.forEach(([c, status], i) =>
    userCoupons.push({
      id: userCoupons.length + 1,
      userId: TEST_CUSTOMER_ID,
      couponId: code(c),
      status,
      savedAt: iso(addDays(new Date('2026-02-01T08:00:00.000Z'), i * 25)),
    }),
  );
  for (const u of users.filter((x) => x.id > 2 && x.status === 'active').slice(0, 12)) {
    for (const c of rng.sample(
      coupons.filter((x) => x.isActive && x.code !== 'GIAM1TR'),
      rng.int(1, 3),
    )) {
      const exp = c.endsAt && new Date(c.endsAt) < MOCK_NOW;
      userCoupons.push({
        id: userCoupons.length + 1,
        userId: u.id,
        couponId: c.id,
        status: exp ? 'expired' : rng.chance(0.3) ? 'used' : 'unused',
        savedAt: iso(addDays(new Date('2026-03-01T08:00:00.000Z'), rng.int(0, 200))),
      });
    }
  }
}
void couponExtras;

// ---------------- Giỏ hàng, yêu thích ----------------
export const carts: Cart[] = [];
export const cartItems: CartItem[] = [];
export const wishlists: Wishlist[] = [];
{
  const nordic = products.find((p) => p.name === 'Sofa Nordic')!;
  const nordicBe = productVariants.find(
    (v) =>
      v.productId === nordic.id && v.salePrice !== null && v.price === 10_500_000 && v.stockQuantity >= 5,
  )!;
  const picks = [
    nordicBe.id,
    productVariants.find(
      (v) =>
        v.productId === products.find((p) => p.name === 'Bàn ăn gỗ tự nhiên')!.id &&
        v.price === 6_200_000 &&
        v.stockQuantity >= 5,
    )!.id,
    productVariants.find(
      (v) => v.productId === products.find((p) => p.name === 'Đèn trang trí')!.id && v.stockQuantity >= 5,
    )!.id,
  ];
  users.forEach((u) => {
    if (u.id === ADMIN_ID) return;
    carts.push({ id: carts.length + 1, userId: u.id, createdAt: u.createdAt, updatedAt: iso(MOCK_NOW) });
  });
  const testCart = carts.find((c) => c.userId === TEST_CUSTOMER_ID)!;
  picks.forEach((vid, i) =>
    cartItems.push({
      id: cartItems.length + 1,
      cartId: testCart.id,
      variantId: vid,
      quantity: i === 2 ? 2 : 1,
      createdAt: '2026-11-04T10:00:00.000Z',
      updatedAt: '2026-11-04T10:00:00.000Z',
    }),
  );
  for (const c of carts) {
    if (c.userId === TEST_CUSTOMER_ID || !rng.chance(0.4)) continue;
    for (const v of rng.sample(productVariants, rng.int(1, 2)))
      cartItems.push({
        id: cartItems.length + 1,
        cartId: c.id,
        variantId: v.id,
        quantity: 1,
        createdAt: iso(addDays(MOCK_NOW, -rng.int(1, 20))),
        updatedAt: iso(MOCK_NOW),
      });
  }
  ['Sofa Luxury', 'Bàn ăn gỗ tự nhiên', 'Ghế thư giãn', 'Giường hiện đại'].forEach((name, i) =>
    wishlists.push({
      id: wishlists.length + 1,
      userId: TEST_CUSTOMER_ID,
      productId: products.find((p) => p.name === name)!.id,
      createdAt: iso(addDays(MOCK_NOW, -10 - i * 6)),
    }),
  );
  for (const u of users.filter((x) => x.id > 2)) {
    for (const p of rng.sample(products, rng.int(0, 4)))
      wishlists.push({
        id: wishlists.length + 1,
        userId: u.id,
        productId: p.id,
        createdAt: iso(addDays(MOCK_NOW, -rng.int(2, 120))),
      });
  }
}

// ---------------- Thông báo (data JSON: type/content/link) ----------------
export const notifications: Notification[] = [];
{
  const add = (
    userId: number,
    title: string,
    type: 'order' | 'promo' | 'system',
    content: string,
    link: string | null,
    at: Date,
    read: boolean,
  ) =>
    notifications.push({
      id: notifications.length + 1,
      userId,
      title,
      data: { type, content, link },
      readAt: read ? iso(addHours(at, 5)) : null,
      createdAt: iso(at),
    });

  const mine = orders.filter((o) => o.userId === TEST_CUSTOMER_ID);
  mine.forEach((o, i) => {
    const link = `/account/orders/${o.orderCode}`;
    const t = (s: string) => new Date(s);
    add(
      TEST_CUSTOMER_ID,
      `Đặt hàng thành công ${o.orderCode}`,
      'order',
      `Đơn hàng ${o.orderCode} đã được ghi nhận. Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.`,
      link,
      t(o.createdAt),
      i < mine.length - 2,
    );
    if (o.status === 'shipping')
      add(
        TEST_CUSTOMER_ID,
        `Đơn ${o.orderCode} đang được giao`,
        'order',
        'Đơn hàng đã được bàn giao cho đơn vị vận chuyển, dự kiến giao trong 2–3 ngày.',
        link,
        addHours(t(o.createdAt), 50),
        false,
      );
    if (o.status === 'completed')
      add(
        TEST_CUSTOMER_ID,
        `Đơn ${o.orderCode} đã giao thành công`,
        'order',
        'Cảm ơn bạn đã mua sắm. Hãy đánh giá sản phẩm để nhận thêm ưu đãi.',
        link,
        new Date(deliveredAtByOrder.get(o.id) ?? o.updatedAt),
        true,
      );
    if (o.status === 'cancelled')
      add(
        TEST_CUSTOMER_ID,
        `Đơn ${o.orderCode} đã được hủy`,
        'order',
        'Đơn hàng của bạn đã được hủy theo yêu cầu.',
        link,
        addHours(t(o.createdAt), 6),
        true,
      );
  });
  add(
    TEST_CUSTOMER_ID,
    'Flash Sale 11.11 – giảm đến 11%',
    'promo',
    'Nhập mã FLASH11 cho đơn từ 2 triệu, áp dụng đến 15/11/2026.',
    '/account/coupons',
    new Date('2026-11-01T01:00:00.000Z'),
    false,
  );
  add(
    TEST_CUSTOMER_ID,
    'Bạn có mã giảm giá mới',
    'promo',
    'Mã SOFA12 giảm 12% cho danh mục Sofa đã được thêm vào ví voucher.',
    '/account/coupons',
    new Date('2026-10-02T03:00:00.000Z'),
    true,
  );
  add(
    TEST_CUSTOMER_ID,
    'Không gian mẫu mới: Phòng khách Japandi',
    'promo',
    'Xem ngay bộ sưu tập phòng khách Japandi với ảnh 360° và combo giảm 10%.',
    '/spaces',
    new Date('2026-09-20T03:00:00.000Z'),
    true,
  );
  add(
    TEST_CUSTOMER_ID,
    'Cập nhật chính sách đổi trả',
    'system',
    'Từ 01/10/2026, thời hạn đổi trả là 7 ngày kể từ ngày nhận hàng.',
    '/policies/chinh-sach-doi-tra',
    new Date('2026-09-28T03:00:00.000Z'),
    true,
  );
  add(
    TEST_CUSTOMER_ID,
    'Bảo trì hệ thống ngày 15/11',
    'system',
    'Website có thể gián đoạn ngắn từ 01:00–02:00 để nâng cấp.',
    null,
    new Date('2026-11-03T03:00:00.000Z'),
    false,
  );
  add(
    TEST_CUSTOMER_ID,
    'Chào mừng bạn đến Aurelia Living',
    'system',
    'Tài khoản của bạn đã sẵn sàng. Khám phá sản phẩm 3D và không gian mẫu ngay.',
    '/products',
    new Date('2026-01-13T03:00:00.000Z'),
    true,
  );
  for (const u of users.filter((x) => x.id > 2)) {
    add(
      u.id,
      'Chào mừng bạn đến Aurelia Living',
      'system',
      'Tài khoản của bạn đã sẵn sàng.',
      '/products',
      new Date(u.createdAt),
      true,
    );
    const o = orders.filter((x) => x.userId === u.id).slice(-1)[0];
    if (o)
      add(
        u.id,
        `Cập nhật đơn ${o.orderCode}`,
        'order',
        `Trạng thái đơn: ${o.status}.`,
        `/account/orders/${o.orderCode}`,
        new Date(o.updatedAt),
        rng.chance(0.5),
      );
  }
  notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  notifications.forEach((n, i) => (n.id = i + 1));
}

// ---------------- Nhật ký hoạt động ----------------
export const activityLogs: ActivityLog[] = [];
{
  const log = (
    actorId: number | null,
    action: string,
    targetType: string,
    targetId: number | null,
    at: Date,
    changes: ActivityLog['changes'] = null,
  ) =>
    activityLogs.push({
      id: activityLogs.length + 1,
      actorId,
      action,
      targetType,
      targetId,
      changes,
      ipAddress: `113.161.${rng.int(1, 250)}.${rng.int(1, 250)}`,
      createdAt: iso(at),
    });
  for (const o of orders.slice(-26))
    log(o.userId, 'order.create', 'order', o.id, new Date(o.createdAt), {
      orderCode: o.orderCode,
      total: o.total,
    });
  for (const r of reviews.slice(-12))
    log(r.userId, 'review.create', 'review', r.id, new Date(r.createdAt), { rating: r.rating });
  for (const u of users.filter((x) => x.id > 2).slice(-8))
    log(u.id, 'user.register', 'user', u.id, new Date(u.createdAt));
  for (const o of orders.filter((x) => x.status !== 'pending' && x.status !== 'cancelled').slice(-14)) {
    const h = orderStatusHistoryFor(o.id);
    if (h)
      log(ADMIN_ID, 'order.update_status', 'order', o.id, new Date(h), {
        orderCode: o.orderCode,
        to: o.status,
      });
  }
  log(ADMIN_ID, 'product.update', 'product', 1, addDays(MOCK_NOW, -2), { field: 'salePrice' });
  log(ADMIN_ID, 'coupon.create', 'coupon', 13, new Date('2026-10-30T02:00:00.000Z'), { code: 'FLASH11' });
  log(ADMIN_ID, 'review.approve', 'review', 3, addDays(MOCK_NOW, -3));
  log(ADMIN_ID, 'model.upload', 'product3dmodel', 5, addDays(MOCK_NOW, -4), { fileName: 'sofa_nordic.glb' });
  activityLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  activityLogs.forEach((l, i) => (l.id = i + 1));
}

function orderStatusHistoryFor(orderId: number): string | null {
  const o = orders[orderId - 1];
  return o ? o.updatedAt : null;
}
