// Sinh dữ liệu giao dịch: orders, order_items, order_status_history, payments, shipments, coupon_usages, inventory_movements.
// 74 đơn trải đều tháng 01–11/2026, đủ mọi trạng thái; tạm tính − giảm giá + phí ship = tổng (tính đúng).
import type {
  CouponUsage,
  InventoryMovement,
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderStatus,
  OrderStatusHistory,
  Payment,
  PaymentMethod,
  Shipment,
} from '@aurelia-living/shared-types';
import { addHours, addMinutes, iso, makeRng, MOCK_NOW } from '../utils/rng';
import { provinces } from '../utils/vi';
import { addresses } from './addresses';
import { couponExtras, coupons } from './coupons';
import { productExtras, productVariants, products } from './_products_gen';
import { ADMIN_ID, TEST_CUSTOMER_ID, users } from './users';

const rng = makeRng(505);
const FREE_SHIP_FROM = 10_000_000;

export const orders: Order[] = [];
export const orderItems: OrderItem[] = [];
export const orderStatusHistory: OrderStatusHistory[] = [];
export const payments: Payment[] = [];
export const shipments: Shipment[] = [];
export const couponUsages: CouponUsage[] = [];
export const inventoryMovements: InventoryMovement[] = [];
/** Thời điểm giao thành công của đơn (để tính hạn đổi trả 7 ngày) */
export const deliveredAtByOrder = new Map<number, string>();

interface Plan {
  userId: number;
  at: Date;
  status: OrderStatus;
  method?: PaymentMethod;
}

const customers = users.filter((u) => u.id > 1);
const buyers = customers.filter((u) => u.id !== TEST_CUSTOMER_ID && u.status !== 'banned');
const loyal = buyers.slice(0, 9);
const bannedUser = customers.find((u) => u.status === 'banned');

const monthCounts = [5, 5, 6, 6, 7, 7, 7, 7, 8, 9, 7]; // tháng 1..11
const plans: Plan[] = [];

monthCounts.forEach((count, m) => {
  const maxDay = m === 10 ? 5 : new Date(2026, m + 1, 0).getDate();
  for (let i = 0; i < count; i++) {
    const day = rng.int(1, maxDay);
    const hour = rng.int(7, 21);
    const at = new Date(Date.UTC(2026, m, day, hour - 7, rng.int(0, 59)));
    if (at.getTime() > MOCK_NOW.getTime() - 3_600_000)
      at.setTime(MOCK_NOW.getTime() - rng.int(2, 40) * 3_600_000);
    const userId = rng.chance(0.55) ? rng.pick(loyal).id : rng.pick(buyers).id;
    plans.push({ userId, at, status: 'completed' });
  }
});

// Khách test: 9 đơn đủ trạng thái
const testPlan: Array<[string, OrderStatus]> = [
  ['2026-03-14T03:20:00.000Z', 'completed'],
  ['2026-05-20T08:05:00.000Z', 'completed'],
  ['2026-07-08T12:40:00.000Z', 'completed'],
  ['2026-10-12T05:10:00.000Z', 'cancelled'],
  ['2026-10-28T02:30:00.000Z', 'completed'],
  ['2026-11-01T04:15:00.000Z', 'shipping'],
  ['2026-11-02T06:45:00.000Z', 'shipping'],
  ['2026-11-03T03:00:00.000Z', 'processing'],
  ['2026-11-04T07:30:00.000Z', 'pending'],
];
testPlan.forEach(([at, status]) => plans.push({ userId: TEST_CUSTOMER_ID, at: new Date(at), status }));

/** Đơn không được tạo trước ngày khách đăng ký */
const alignWithSignup = () => {
  for (const p of plans) {
    const created = new Date(users.find((u) => u.id === p.userId)!.createdAt);
    if (p.at < created && p.userId !== TEST_CUSTOMER_ID && p.userId !== bannedUser?.id) {
      // ưu tiên đổi sang khách đã đăng ký trước thời điểm đặt hàng để giữ đúng phân bố theo tháng
      const early = buyers.filter((u) => new Date(u.createdAt) <= p.at);
      if (early.length) {
        p.userId = rng.pick(early).id;
        continue;
      }
    }
    if (p.at < new Date(users.find((u) => u.id === p.userId)!.createdAt)) {
      p.at = addHours(new Date(users.find((u) => u.id === p.userId)!.createdAt), rng.int(30, 120));
      if (p.at.getTime() > MOCK_NOW.getTime() - 3_600_000)
        p.at = new Date(MOCK_NOW.getTime() - rng.int(60, 600) * 3_600_000);
    }
  }
};
alignWithSignup();

// Trạng thái cho các đơn còn lại theo độ tuổi đơn
const ageDays = (d: Date) => (MOCK_NOW.getTime() - d.getTime()) / 86_400_000;
plans.forEach((p, idx) => {
  if (p.userId === TEST_CUSTOMER_ID) return;
  const age = ageDays(p.at);
  const r = rng.next();
  if (age >= 20) p.status = r < 0.86 ? 'completed' : r < 0.94 ? 'cancelled' : 'refunded';
  else if (age >= 8)
    p.status =
      r < 0.6
        ? 'completed'
        : r < 0.75
          ? 'shipping'
          : r < 0.85
            ? 'processing'
            : r < 0.93
              ? 'cancelled'
              : 'confirmed';
  else
    p.status =
      r < 0.35
        ? 'pending'
        : r < 0.55
          ? 'confirmed'
          : r < 0.75
            ? 'processing'
            : r < 0.95
              ? 'shipping'
              : 'cancelled';
  void idx;
});
// bảo đảm có đủ trạng thái hiếm
const locked = new Set<Plan>();
const ensure = (status: OrderStatus, ageMin: number, ageMax: number, n: number) => {
  let have = plans.filter((p) => p.status === status && p.userId !== TEST_CUSTOMER_ID).length;
  for (const p of plans) {
    if (have >= n) break;
    const a = ageDays(p.at);
    if (
      p.userId !== TEST_CUSTOMER_ID &&
      !locked.has(p) &&
      a >= ageMin &&
      a <= ageMax &&
      p.status !== status &&
      p.status !== 'refunded'
    ) {
      p.status = status;
      locked.add(p);
      have++;
    }
  }
};
ensure('refunded', 30, 400, 3);
ensure('confirmed', 0, 10, 3);
ensure('pending', 0, 6, 4);
ensure('shipping', 1, 12, 5);
ensure('cancelled', 15, 300, 5);
ensure('processing', 1, 10, 4);
if (bannedUser) {
  // tài khoản bị cấm: có vài đơn hủy cũ
  [plans[3], plans[9], plans[18]].forEach((p) => {
    if (p) {
      p.userId = bannedUser.id;
      p.status = 'cancelled';
    }
  });
}

alignWithSignup();
plans.sort((a, b) => a.at.getTime() - b.at.getTime());

const methodWeights: Array<[PaymentMethod, number]> = [
  ['cod', 0.34],
  ['bank_transfer', 0.14],
  ['vnpay', 0.2],
  ['momo', 0.12],
  ['zalopay', 0.08],
  ['card', 0.12],
];
const pickMethod = (): PaymentMethod => {
  let r = rng.next();
  for (const [m, w] of methodWeights) {
    if ((r -= w) <= 0) return m;
  }
  return 'cod';
};
const online: PaymentMethod[] = ['vnpay', 'momo', 'zalopay', 'card'];

const dayCounter = new Map<string, number>();
const usedByUserCoupon = new Map<string, number>();
const sellable = productVariants.filter(
  (v) => products.find((p) => p.id === v.productId)?.status === 'published',
);
const soldQtyByVariant = new Map<number, number>();

const effective = (v: { price: number; salePrice: number | null }) => v.salePrice ?? v.price;

plans.forEach((plan, i) => {
  const id = i + 1;
  const t0 = plan.at;
  const ymd = iso(t0).slice(0, 10).replace(/-/g, '');
  const seq = (dayCounter.get(ymd) ?? 0) + 1;
  dayCounter.set(ymd, seq);
  const orderCode = `ALV-${ymd}-${String(seq).padStart(4, '0')}`;

  const user = users.find((u) => u.id === plan.userId)!;
  const userAddrs = addresses.filter((a) => a.userId === user.id);
  const addr = userAddrs.find((a) => a.isDefault) ?? userAddrs[0];
  const zone = provinces.find((p) => p.province === addr.province) ?? provinces[0];

  // ---- Dòng hàng ----
  const nLines = rng.chance(0.55) ? rng.int(2, 3) : 1;
  const chosen = rng.sample(sellable, nLines);
  const lines = chosen.map((v) => ({ v, qty: rng.chance(0.75) ? 1 : 2 }));
  const subtotal = lines.reduce((s, l) => s + effective(l.v) * l.qty, 0);
  const shippingFee = subtotal >= FREE_SHIP_FROM ? 0 : zone.fee;

  // ---- Mã giảm giá ----
  let couponId: number | null = null;
  let discount = 0;
  if (rng.chance(0.4)) {
    const cands = coupons.filter((c, ci) => {
      const ex = couponExtras[ci];
      if (!c.isActive || c.code === 'BLACKFRIDAY' || c.code === 'TET2027') return false;
      if (new Date(c.startsAt) > t0 || (c.endsAt && new Date(c.endsAt) < t0)) return false;
      if (subtotal < c.minOrderValue) return false;
      if (ex.kind === 'freeship' && shippingFee === 0) return false;
      if (
        ex.categoryIds.length &&
        !lines.some((l) =>
          ex.categoryIds.includes(products.find((p) => p.id === l.v.productId)!.categoryId ?? -1),
        )
      )
        return false;
      if ((usedByUserCoupon.get(`${user.id}:${c.id}`) ?? 0) >= (c.perUserLimit ?? 99)) return false;
      return true;
    });
    if (cands.length) {
      const c = rng.pick(cands);
      const ex = couponExtras[c.id - 1];
      couponId = c.id;
      discount =
        ex.kind === 'percent'
          ? Math.min(Math.floor((subtotal * c.value) / 100), c.maxDiscount ?? Infinity)
          : ex.kind === 'fixed'
            ? Math.min(c.value, subtotal)
            : shippingFee;
      usedByUserCoupon.set(`${user.id}:${c.id}`, (usedByUserCoupon.get(`${user.id}:${c.id}`) ?? 0) + 1);
    }
  }
  const total = subtotal - discount + shippingFee;

  // ---- Trạng thái & thanh toán ----
  const status = plan.status;
  const method: PaymentMethod = plan.method ?? pickMethod();
  const isOnline = online.includes(method);
  let paymentStatus: OrderPaymentStatus;
  if (status === 'refunded') paymentStatus = 'refunded';
  else if (status === 'completed') paymentStatus = 'paid';
  else if (status === 'cancelled') paymentStatus = isOnline && rng.chance(0.25) ? 'failed' : 'unpaid';
  else if (status === 'pending') paymentStatus = 'unpaid';
  else paymentStatus = method === 'cod' ? 'unpaid' : 'paid';

  // ---- Mốc thời gian ----
  const tConfirm = addHours(t0, rng.int(1, 10));
  const tProcess = addHours(tConfirm, rng.int(4, 20));
  const tShip = addHours(tProcess, rng.int(18, 44));
  const tDone = addHours(tShip, rng.int(48, 110));
  const reached: OrderStatus[] =
    status === 'pending'
      ? ['pending']
      : status === 'confirmed'
        ? ['pending', 'confirmed']
        : status === 'processing'
          ? ['pending', 'confirmed', 'processing']
          : status === 'shipping'
            ? ['pending', 'confirmed', 'processing', 'shipping']
            : status === 'cancelled'
              ? ['pending', 'cancelled']
              : status === 'refunded'
                ? ['pending', 'confirmed', 'processing', 'shipping', 'completed', 'refunded']
                : ['pending', 'confirmed', 'processing', 'shipping', 'completed'];
  const stampOf: Record<string, Date> = {
    pending: t0,
    confirmed: tConfirm,
    processing: tProcess,
    shipping: tShip,
    completed: tDone,
    refunded: addHours(tDone, 30),
    cancelled: addHours(t0, rng.int(2, 30)),
  };

  const cancelledByUser = status === 'cancelled' && (user.id === TEST_CUSTOMER_ID || rng.chance(0.6));
  const cancelReason =
    status === 'cancelled'
      ? cancelledByUser
        ? rng.pick([
            'Tôi muốn đổi sang màu khác',
            'Đặt nhầm sản phẩm',
            'Tìm được giá tốt hơn ở nơi khác',
            'Thay đổi nhu cầu',
          ])
        : 'Khách không liên lạc được để xác nhận đơn'
      : null;
  const lastStamp = stampOf[reached[reached.length - 1]];

  orders.push({
    id,
    uuid: `30000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    orderCode,
    userId: user.id,
    status,
    recipientName: addr.recipientName,
    recipientPhone: addr.phone,
    shippingProvince: addr.province,
    shippingDistrict: addr.district,
    shippingWard: addr.ward,
    shippingAddress: addr.addressLine,
    subtotal,
    discountAmount: discount,
    shippingFee,
    total,
    couponId,
    paymentMethod: method,
    paymentStatus,
    note: rng.chance(0.25)
      ? rng.pick([
          'Giao giờ hành chính giúp mình',
          'Gọi trước khi giao 30 phút',
          'Nhà có thang máy, giao tận cửa',
          'Để hàng ở bảo vệ nếu mình vắng',
        ])
      : null,
    cancelReason,
    createdAt: iso(t0),
    updatedAt: iso(lastStamp),
  });

  lines.forEach((l) => {
    const p = products.find((x) => x.id === l.v.productId)!;
    orderItems.push({
      id: orderItems.length + 1,
      orderId: id,
      variantId: l.v.id,
      productName: p.name,
      sku: l.v.sku,
      unitPrice: effective(l.v),
      quantity: l.qty,
      lineTotal: effective(l.v) * l.qty,
      createdAt: iso(t0),
    });
    if (status !== 'cancelled' && status !== 'refunded')
      soldQtyByVariant.set(l.v.id, (soldQtyByVariant.get(l.v.id) ?? 0) + l.qty);
  });

  // ---- Lịch sử trạng thái ----
  reached.forEach((st, k) => {
    const from = k === 0 ? null : reached[k - 1];
    const adminDid =
      ['confirmed', 'processing', 'shipping'].includes(st) ||
      (st === 'cancelled' && !cancelledByUser) ||
      st === 'refunded';
    orderStatusHistory.push({
      id: orderStatusHistory.length + 1,
      orderId: id,
      fromStatus: from,
      toStatus: st,
      changedBy:
        st === 'pending'
          ? user.id
          : st === 'completed'
            ? null
            : st === 'cancelled'
              ? cancelledByUser
                ? user.id
                : ADMIN_ID
              : adminDid
                ? ADMIN_ID
                : null,
      note:
        st === 'pending'
          ? 'Khách hàng đặt hàng'
          : st === 'confirmed'
            ? isOnline && paymentStatus === 'paid'
              ? 'Thanh toán online thành công, hệ thống tự xác nhận'
              : 'Doanh nghiệp xác nhận đơn hàng'
            : st === 'processing'
              ? 'Đang chuẩn bị hàng và đóng gói'
              : st === 'shipping'
                ? 'Bàn giao cho đơn vị vận chuyển'
                : st === 'completed'
                  ? 'Giao hàng thành công'
                  : st === 'refunded'
                    ? 'Hoàn tiền thủ công cho khách'
                    : cancelReason,
      createdAt: iso(stampOf[st]),
    });
  });

  // ---- Thanh toán ----
  const paidAt =
    paymentStatus === 'paid' || paymentStatus === 'refunded'
      ? iso(method === 'cod' ? tDone : addMinutes(t0, rng.int(2, 40)))
      : null;
  payments.push({
    id: payments.length + 1,
    orderId: id,
    method,
    amount: total,
    status:
      paymentStatus === 'paid'
        ? 'success'
        : paymentStatus === 'refunded'
          ? 'refunded'
          : paymentStatus === 'failed'
            ? 'failed'
            : 'pending',
    transactionCode:
      isOnline && paymentStatus !== 'unpaid'
        ? `${method.toUpperCase()}${rng.int(10_000_000, 99_999_999)}`
        : method === 'bank_transfer' && paymentStatus === 'paid'
          ? `CK${rng.int(100000, 999999)}`
          : null,
    gatewayResponse:
      isOnline && paymentStatus === 'paid' ? { code: '00', message: 'Giao dịch thành công' } : null,
    paidAt,
    createdAt: iso(t0),
    updatedAt: paidAt ?? iso(t0),
  });
  if (method === 'cod' && status === 'completed') {
    // COD: thanh toán khi giao (D-N02/D-N14)
    payments[payments.length - 1].paidAt = iso(tDone);
  }

  // ---- Vận chuyển ----
  if (['shipping', 'completed', 'refunded'].includes(status)) {
    const carrier = rng.pick(['ghn', 'ghtk', 'viettel_post'] as const);
    const done = status !== 'shipping';
    shipments.push({
      id: shipments.length + 1,
      orderId: id,
      carrier,
      trackingCode: `${carrier === 'ghn' ? 'GHN' : carrier === 'ghtk' ? 'GHTK' : 'VTP'}${rng.int(100_000_000, 999_999_999)}`,
      status: done ? 'delivered' : 'in_transit',
      fee: shippingFee,
      shippedAt: iso(tShip),
      deliveredAt: done ? iso(tDone) : null,
      createdAt: iso(tProcess),
      updatedAt: iso(done ? tDone : tShip),
    });
    if (done) deliveredAtByOrder.set(id, iso(tDone));
  }

  // ---- Lượt dùng coupon (hủy đơn → hoàn lượt dùng, D-N01) ----
  if (couponId && status !== 'cancelled')
    couponUsages.push({
      id: couponUsages.length + 1,
      couponId,
      userId: user.id,
      orderId: id,
      createdAt: iso(t0),
    });
});

// ---- Nhập kho ban đầu + biến động tồn kho (import − sale ⇒ đúng tồn hiện tại) ----
productVariants.forEach((v) => {
  const p = products.find((x) => x.id === v.productId)!;
  const sold = soldQtyByVariant.get(v.id) ?? 0;
  inventoryMovements.push({
    id: inventoryMovements.length + 1,
    variantId: v.id,
    type: 'import',
    quantityChange: v.stockQuantity + sold,
    reason: 'Nhập kho ban đầu',
    referenceCode: `PN-${String(p.id).padStart(3, '0')}`,
    performedBy: ADMIN_ID,
    createdAt: p.createdAt,
  });
});
orderItems.forEach((it) => {
  const o = orders[it.orderId - 1];
  if (o.status === 'cancelled') return;
  inventoryMovements.push({
    id: inventoryMovements.length + 1,
    variantId: it.variantId!,
    type: 'sale',
    quantityChange: -it.quantity,
    reason: 'Bán hàng',
    referenceCode: o.orderCode,
    performedBy: null,
    createdAt: o.createdAt,
  });
  if (o.status === 'refunded')
    inventoryMovements.push({
      id: inventoryMovements.length + 1,
      variantId: it.variantId!,
      type: 'return',
      quantityChange: it.quantity,
      reason: 'Hoàn hàng',
      referenceCode: o.orderCode,
      performedBy: ADMIN_ID,
      createdAt: o.updatedAt,
    });
});
inventoryMovements.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
inventoryMovements.forEach((m, i) => (m.id = i + 1));

void productExtras;
