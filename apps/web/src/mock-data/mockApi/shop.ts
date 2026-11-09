// Mock API: giỏ hàng, mã giảm giá, đặt hàng, thanh toán giả lập, đơn hàng, đổi trả (khách hàng)
import type { OrderPaymentStatus, OrderStatus, PaymentMethod } from '@aurelia-living/shared-types';
import type { ReturnRequest } from '@/types/api';
import { nextId, type Db } from '../db';
import {
  ApiFail,
  created,
  nowIso,
  notFound,
  ok,
  paginate,
  qList,
  qNum,
  qStr,
  validation,
  type Ctx,
  type Result,
} from './http';
import {
  cartLines,
  cartView,
  effectivePrice,
  evaluateCoupon,
  orderView,
  RETURN_WINDOW_DAYS,
  shippingFeeFor,
  variantLabel,
  variantViews,
} from './views';

// ---------------- Giỏ hàng ----------------
function ensureCart(ctx: Ctx) {
  let cart = ctx.db.carts.find((c) => c.userId === ctx.user!.id);
  if (!cart) {
    cart = { id: nextId(ctx.db.carts), userId: ctx.user!.id, createdAt: nowIso(), updatedAt: nowIso() };
    ctx.db.carts.push(cart);
  }
  return cart;
}

export const getCart = (ctx: Ctx): Result =>
  ok(
    cartView(ctx.db, ctx.user!.id, {
      itemIds: qList(ctx.query, 'items').map(Number),
      addressId: qNum(ctx.query, 'addressId', 0) || null,
    }),
  );

export function addCartItem(ctx: Ctx): Result {
  const { variantId, quantity = 1 } = ctx.body ?? {};
  const v = ctx.db.productVariants.find((x) => x.id === Number(variantId) && x.isActive);
  if (!v) throw notFound('Biến thể sản phẩm');
  const qty = Math.floor(Number(quantity));
  if (!(qty >= 1)) throw validation({ quantity: 'Số lượng phải từ 1 trở lên.' });
  const cart = ensureCart(ctx);
  const existing = ctx.db.cartItems.find((i) => i.cartId === cart.id && i.variantId === v.id);
  const total = (existing?.quantity ?? 0) + qty;
  if (total > v.stockQuantity)
    throw new ApiFail(
      'OUT_OF_STOCK',
      v.stockQuantity > 0 ? `Chỉ còn ${v.stockQuantity} sản phẩm trong kho.` : 'Sản phẩm tạm hết hàng.',
      { variantId: v.id, available: v.stockQuantity },
    );
  if (existing) {
    existing.quantity = total;
    existing.updatedAt = nowIso();
  } else
    ctx.db.cartItems.push({
      id: nextId(ctx.db.cartItems),
      cartId: cart.id,
      variantId: v.id,
      quantity: qty,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  return created(cartView(ctx.db, ctx.user!.id));
}

function ownCartItem(ctx: Ctx) {
  const cart = ensureCart(ctx);
  const it = ctx.db.cartItems.find((i) => i.id === Number(ctx.params.id) && i.cartId === cart.id);
  if (!it) throw notFound('Sản phẩm trong giỏ');
  return it;
}

export function updateCartItem(ctx: Ctx): Result {
  const it = ownCartItem(ctx);
  const qty = Math.floor(Number(ctx.body?.quantity));
  if (!(qty >= 1)) throw validation({ quantity: 'Số lượng phải từ 1 trở lên.' });
  const v = ctx.db.productVariants.find((x) => x.id === it.variantId)!;
  if (qty > v.stockQuantity)
    throw new ApiFail('OUT_OF_STOCK', `Chỉ còn ${v.stockQuantity} sản phẩm trong kho.`, {
      variantId: v.id,
      available: v.stockQuantity,
    });
  it.quantity = qty;
  it.updatedAt = nowIso();
  return ok(cartView(ctx.db, ctx.user!.id));
}

export function removeCartItem(ctx: Ctx): Result {
  const it = ownCartItem(ctx);
  ctx.db.cartItems.splice(ctx.db.cartItems.indexOf(it), 1);
  return ok(cartView(ctx.db, ctx.user!.id));
}

export function clearCart(ctx: Ctx): Result {
  const cart = ensureCart(ctx);
  ctx.db.cartItems = ctx.db.cartItems.filter((i) => i.cartId !== cart.id);
  delete ctx.db.cartCoupons[ctx.user!.id];
  return ok(cartView(ctx.db, ctx.user!.id));
}

export function applyCoupon(ctx: Ctx): Result {
  const code = String(ctx.body?.code ?? '').trim();
  if (!code) throw validation({ code: 'Vui lòng nhập mã giảm giá.' });
  const view = cartView(ctx.db, ctx.user!.id);
  if (!view.items.length) throw new ApiFail('COUPON_INVALID', 'Giỏ hàng đang trống.');
  evaluateCoupon(
    ctx.db,
    code,
    ctx.user!.id,
    view.items.map((i) => ({
      productId: i.productId,
      categoryId: ctx.db.products.find((p) => p.id === i.productId)?.categoryId ?? null,
      lineTotal: i.lineTotal,
    })),
    view.subtotal,
    view.shippingFee,
  );
  ctx.db.cartCoupons[ctx.user!.id] = code;
  return ok(cartView(ctx.db, ctx.user!.id));
}

export function removeCoupon(ctx: Ctx): Result {
  delete ctx.db.cartCoupons[ctx.user!.id];
  return ok(cartView(ctx.db, ctx.user!.id));
}

// ---------------- Đơn hàng ----------------
function nextOrderCode(db: Db, d: Date): string {
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const n = db.orders.filter((o) => o.orderCode.startsWith(`ALV-${ymd}-`)).length + 1;
  return `ALV-${ymd}-${String(n).padStart(4, '0')}`;
}

function addHistory(
  db: Db,
  orderId: number,
  from: OrderStatus | null,
  to: OrderStatus,
  changedBy: number | null,
  note: string | null,
) {
  db.orderStatusHistory.push({
    id: nextId(db.orderStatusHistory),
    orderId,
    fromStatus: from,
    toStatus: to,
    changedBy,
    note,
    createdAt: nowIso(),
  });
}

export function notify(
  db: Db,
  userId: number,
  title: string,
  type: 'order' | 'promo' | 'system',
  content: string,
  link: string | null,
) {
  db.notifications.push({
    id: nextId(db.notifications),
    userId,
    title,
    data: { type, content, link },
    readAt: null,
    createdAt: nowIso(),
  });
}

export interface OrderLine {
  v: Db['productVariants'][number];
  p: Db['products'][number];
  qty: number;
}

/** Lõi tạo đơn: dùng cho khách đặt hàng (từ giỏ) và cho admin tạo đơn hộ khách */
export function placeOrderCore(
  db: Db,
  u: Db['users'][number],
  addr: Db['addresses'][number],
  paymentMethod: PaymentMethod,
  note: string | null,
  lines: OrderLine[],
  code: string | undefined,
  actorId: number | null,
) {
  const subtotal = lines.reduce((s, l) => s + effectivePrice(l.v) * l.qty, 0);
  const shippingFee = shippingFeeFor(db, u.id, subtotal, addr.id);

  let couponId: number | null = null;
  let discount = 0;
  if (code) {
    const r = evaluateCoupon(
      db,
      code,
      u.id,
      lines.map((l) => ({
        productId: l.p.id,
        categoryId: l.p.categoryId,
        lineTotal: effectivePrice(l.v) * l.qty,
      })),
      subtotal,
      shippingFee,
    );
    couponId = r.coupon.id;
    discount = r.discount;
  }

  const at = new Date();
  const id = nextId(db.orders);
  const orderCode = nextOrderCode(db, at);
  const total = subtotal - discount + shippingFee;
  db.orders.push({
    id,
    uuid: `30000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    orderCode,
    userId: u.id,
    status: 'pending',
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
    paymentMethod,
    paymentStatus: 'unpaid',
    note: note ? String(note) : null,
    cancelReason: null,
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
  });
  for (const l of lines) {
    db.orderItems.push({
      id: nextId(db.orderItems),
      orderId: id,
      variantId: l.v.id,
      productName: l.p.name,
      sku: l.v.sku,
      unitPrice: effectivePrice(l.v),
      quantity: l.qty,
      lineTotal: effectivePrice(l.v) * l.qty,
      createdAt: at.toISOString(),
    });
    l.v.stockQuantity -= l.qty;
    db.inventoryMovements.push({
      id: nextId(db.inventoryMovements),
      variantId: l.v.id,
      type: 'sale',
      quantityChange: -l.qty,
      reason: 'Bán hàng',
      referenceCode: orderCode,
      performedBy: null,
      createdAt: at.toISOString(),
    });
    l.p.soldCount += l.qty;
  }
  db.payments.push({
    id: nextId(db.payments),
    orderId: id,
    method: paymentMethod,
    amount: total,
    status: 'pending',
    transactionCode: null,
    gatewayResponse: null,
    paidAt: null,
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
  });
  addHistory(
    db,
    id,
    null,
    'pending',
    actorId ?? u.id,
    actorId && actorId !== u.id ? 'Doanh nghiệp tạo đơn hàng' : 'Khách hàng đặt hàng',
  );
  if (couponId) {
    db.couponUsages.push({
      id: nextId(db.couponUsages),
      couponId,
      userId: u.id,
      orderId: id,
      createdAt: at.toISOString(),
    });
    const c = db.coupons.find((x) => x.id === couponId)!;
    c.usedCount += 1;
    const uc = db.userCoupons.find(
      (x) => x.userId === u.id && x.couponId === couponId && x.status === 'unused',
    );
    if (uc) uc.status = 'used';
  }
  notify(
    db,
    u.id,
    `Đặt hàng thành công ${orderCode}`,
    'order',
    `Đơn hàng ${orderCode} đã được ghi nhận. Chúng tôi sẽ liên hệ xác nhận sớm nhất.`,
    `/account/orders/${orderCode}`,
  );
  db.activityLogs.push({
    id: nextId(db.activityLogs),
    actorId: actorId ?? u.id,
    action: 'order.create',
    targetType: 'order',
    targetId: id,
    changes: { orderCode, total },
    ipAddress: '127.0.0.1',
    createdAt: at.toISOString(),
  });
  return db.orders.find((o) => o.id === id)!;
}

export function createOrder(ctx: Ctx): Result {
  const db = ctx.db;
  const u = ctx.user!;
  const { addressId, paymentMethod, note, itemIds } = ctx.body ?? {};
  const errs: Record<string, string> = {};
  const addr = db.addresses.find((a) => a.id === Number(addressId) && a.userId === u.id);
  if (!addr) errs.addressId = 'Vui lòng chọn địa chỉ nhận hàng.';
  const methods: PaymentMethod[] = ['cod', 'bank_transfer', 'momo', 'vnpay', 'zalopay', 'card'];
  if (!methods.includes(paymentMethod)) errs.paymentMethod = 'Vui lòng chọn phương thức thanh toán.';
  if (Object.keys(errs).length) throw validation(errs);

  const { cart, items } = cartLines(db, u.id);
  const chosen =
    Array.isArray(itemIds) && itemIds.length ? items.filter((i) => itemIds.includes(i.id)) : items;
  if (!cart || !chosen.length) throw new ApiFail('BAD_REQUEST', 'Giỏ hàng đang trống.');

  // Kiểm tra tồn kho (D-N05: trừ tồn khi tạo đơn)
  const lines = chosen.map((it) => {
    const v = db.productVariants.find((x) => x.id === it.variantId)!;
    const p = db.products.find((x) => x.id === v.productId)!;
    if (v.stockQuantity < it.quantity)
      throw new ApiFail('OUT_OF_STOCK', `"${p.name}" chỉ còn ${v.stockQuantity} sản phẩm trong kho.`, {
        variantId: v.id,
        available: v.stockQuantity,
      });
    return { v, p, qty: it.quantity };
  });
  const code = chosen.length === items.length ? db.cartCoupons[u.id] : undefined; // mã chỉ áp dụng khi đặt cả giỏ
  const order = placeOrderCore(db, u, addr!, paymentMethod, note ? String(note) : null, lines, code, null);
  db.cartItems = db.cartItems.filter((i) => !chosen.some((c) => c.id === i.id));
  delete db.cartCoupons[u.id];
  return created(orderView(db, order));
}

export function listOrders(ctx: Ctx): Result {
  const statuses = qList(ctx.query, 'status'); // hỗ trợ nhiều trạng thái: status=confirmed,processing
  const list = ctx.db.orders
    .filter((o) => o.userId === ctx.user!.id && (!statuses.length || statuses.includes(o.status)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => orderView(ctx.db, o));
  return paginate(list, ctx.query, 5);
}

export function orderCounts(ctx: Ctx): Result {
  const mine = ctx.db.orders.filter((o) => o.userId === ctx.user!.id);
  const out: Record<string, number> = { all: mine.length };
  for (const s of ['pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded'])
    out[s] = mine.filter((o) => o.status === s).length;
  return ok(out);
}

function ownOrderByCode(ctx: Ctx) {
  const o = ctx.db.orders.find((x) => x.orderCode === ctx.params.code && x.userId === ctx.user!.id);
  if (!o) throw notFound('Đơn hàng'); // user truy cập đơn người khác → 404 (API_CONVENTIONS §7)
  return o;
}

export const orderDetail = (ctx: Ctx): Result => ok(orderView(ctx.db, ownOrderByCode(ctx)));

/** Hủy đơn: hoàn tồn kho + lượt dùng coupon (D-N01) */
export function cancelOrderCore(
  db: Db,
  orderId: number,
  actorId: number | null,
  reason: string,
  byAdmin: boolean,
) {
  const o = db.orders.find((x) => x.id === orderId)!;
  const allowed: OrderStatus[] = byAdmin ? ['pending', 'confirmed', 'processing'] : ['pending', 'confirmed'];
  if (byAdmin && o.status === 'shipping') {
    // D-N34: đơn đang giao chỉ hủy được khi mọi vận đơn đã hoàn về (returned)
    const ships = db.shipments.filter((x) => x.orderId === orderId);
    if (!ships.length || !ships.every((x) => x.status === 'returned'))
      throw new ApiFail('INVALID_STATE', 'Đơn đang giao chỉ hủy được khi vận đơn đã hoàn về (returned).');
  } else if (!allowed.includes(o.status))
    throw new ApiFail('INVALID_STATE', 'Không thể hủy đơn hàng ở trạng thái hiện tại.');
  const from = o.status;
  o.status = 'cancelled';
  o.cancelReason = reason;
  o.updatedAt = nowIso();
  for (const it of db.orderItems.filter((x) => x.orderId === o.id)) {
    const v = db.productVariants.find((x) => x.id === it.variantId);
    if (v) {
      v.stockQuantity += it.quantity;
      db.inventoryMovements.push({
        id: nextId(db.inventoryMovements),
        variantId: v.id,
        type: 'return',
        quantityChange: it.quantity,
        reason: 'Hoàn kho do hủy đơn',
        referenceCode: o.orderCode,
        performedBy: actorId,
        createdAt: nowIso(),
      });
    }
  }
  const usage = db.couponUsages.find((u) => u.orderId === o.id);
  if (usage) {
    db.couponUsages = db.couponUsages.filter((u) => u.id !== usage.id);
    const c = db.coupons.find((x) => x.id === usage.couponId);
    if (c) c.usedCount = Math.max(0, c.usedCount - 1);
  }
  const pay = db.payments.find((p) => p.orderId === o.id);
  if (pay && pay.status === 'pending') pay.status = 'failed';
  addHistory(db, o.id, from, 'cancelled', actorId, reason);
  notify(db, o.userId, `Đơn ${o.orderCode} đã được hủy`, 'order', reason, `/account/orders/${o.orderCode}`);
  return o;
}

export function cancelOrder(ctx: Ctx): Result {
  const o = ctx.db.orders.find((x) => x.id === Number(ctx.params.id) && x.userId === ctx.user!.id);
  if (!o) throw notFound('Đơn hàng');
  const reason = String(ctx.body?.reason ?? '').trim() || 'Khách hàng yêu cầu hủy đơn';
  cancelOrderCore(ctx.db, o.id, ctx.user!.id, reason, false);
  return ok(orderView(ctx.db, o));
}

// ---------------- Thanh toán giả lập (cổng VNPAY sandbox) ----------------
function settle(db: Db, orderId: number, success: boolean) {
  const o = db.orders.find((x) => x.id === orderId)!;
  const pay = db.payments.find((p) => p.orderId === o.id)!;
  const at = nowIso();
  if (success) {
    pay.status = 'success';
    pay.paidAt = at;
    pay.transactionCode = `${o.paymentMethod.toUpperCase()}${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    pay.gatewayResponse = { code: '00', message: 'Giao dịch thành công' };
    pay.updatedAt = at;
    o.paymentStatus = 'paid';
    if (o.status === 'pending') {
      o.status = 'confirmed'; // D-N13: thanh toán online thành công tự xác nhận
      addHistory(
        db,
        o.id,
        'pending',
        'confirmed',
        null,
        'Thanh toán online thành công, hệ thống tự xác nhận',
      );
    }
  } else {
    pay.status = 'failed';
    pay.gatewayResponse = { code: '24', message: 'Khách hàng hủy giao dịch' };
    pay.updatedAt = at;
    o.paymentStatus = 'failed' as OrderPaymentStatus;
  }
  o.updatedAt = at;
  return o;
}

export function checkoutPayment(ctx: Ctx): Result {
  const o = ctx.db.orders.find((x) => x.id === Number(ctx.params.orderId) && x.userId === ctx.user!.id);
  if (!o) throw notFound('Đơn hàng');
  if (o.paymentStatus === 'paid') throw new ApiFail('INVALID_STATE', 'Đơn hàng đã được thanh toán.');
  const online = (['vnpay', 'momo', 'zalopay', 'card'] as PaymentMethod[]).includes(o.paymentMethod);
  if (!online) return ok({ redirectUrl: `/checkout/success?order=${o.orderCode}` });
  const outcome = /\[fail\]/i.test(o.note ?? '') ? 'failed' : 'success'; // như BE thật: không nhận outcome từ body
  settle(ctx.db, o.id, outcome === 'success');
  return ok({
    redirectUrl: `/checkout/${outcome === 'success' ? 'success' : 'failed'}?order=${o.orderCode}`,
  });
}

export function retryPayment(ctx: Ctx): Result {
  const o = ctx.db.orders.find((x) => x.id === Number(ctx.params.orderId) && x.userId === ctx.user!.id);
  if (!o) throw notFound('Đơn hàng');
  if (o.paymentStatus === 'paid') throw new ApiFail('INVALID_STATE', 'Đơn hàng đã được thanh toán.');
  if (o.status === 'cancelled') throw new ApiFail('INVALID_STATE', 'Đơn hàng đã bị hủy.');
  if (ctx.body?.method) {
    o.paymentMethod = ctx.body.method;
    const pay = ctx.db.payments.find((p) => p.orderId === o.id)!;
    pay.method = ctx.body.method;
    pay.status = 'pending';
  }
  const online = (['vnpay', 'momo', 'zalopay', 'card'] as PaymentMethod[]).includes(o.paymentMethod);
  if (online) settle(ctx.db, o.id, true);
  return ok({ redirectUrl: `/checkout/success?order=${o.orderCode}` });
}

// ---------------- Đổi trả & hoàn tiền (khách) ----------------
export function listReturns(ctx: Ctx): Result {
  const status = qStr(ctx.query, 'status');
  const list = ctx.db.returnRequests
    .filter((r) => r.userId === ctx.user!.id && (!status || r.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => withReturnItemMeta(ctx.db, r));
  return paginate(list, ctx.query, 5);
}

export function withReturnItemMeta(db: Db, r: ReturnRequest): ReturnRequest {
  return {
    ...r,
    items: r.items.map((it) => {
      const img = db.productImages.find((i) => i.productId === it.productId && i.isPrimary);
      const p = db.products.find((x) => x.id === it.productId);
      void p;
      return {
        ...it,
        imageUrl: it.imageUrl ?? db.media.find((m) => m.id === img?.mediaId)?.filePath ?? null,
      };
    }),
  };
}

export function createReturn(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const o = ctx.db.orders.find((x) => x.id === Number(b.orderId) && x.userId === ctx.user!.id);
  if (!o) throw notFound('Đơn hàng');
  const errs: Record<string, string> = {};
  if (!Array.isArray(b.items) || !b.items.length) errs.items = 'Vui lòng chọn ít nhất một sản phẩm.';
  if (!['refund', 'exchange'].includes(b.type)) errs.type = 'Vui lòng chọn hình thức.';
  if (!b.reason) errs.reason = 'Vui lòng chọn lý do.';
  if (String(b.description ?? '').trim().length < 10) errs.description = 'Mô tả chi tiết tối thiểu 10 ký tự.';
  if (!Array.isArray(b.images) || !b.images.length) errs.images = 'Vui lòng tải lên ảnh/video minh chứng.';
  if (Object.keys(errs).length) throw validation(errs);
  const view = orderView(ctx.db, o);
  if (o.status !== 'completed' || !view.canReturnUntil || new Date(view.canReturnUntil) < new Date())
    throw new ApiFail('INVALID_STATE', `Đơn hàng đã quá hạn ${RETURN_WINDOW_DAYS} ngày đổi trả.`);
  const items = (b.items as Array<{ orderItemId: number; quantity: number }>).map((x) => {
    const it = ctx.db.orderItems.find((y) => y.id === x.orderItemId && y.orderId === o.id);
    if (!it) throw notFound('Sản phẩm trong đơn');
    const v = ctx.db.productVariants.find((z) => z.id === it.variantId)!;
    const qty = Math.min(Math.max(1, Number(x.quantity)), it.quantity);
    return {
      productId: v.productId,
      productName: it.productName,
      imageUrl: null,
      variantLabel: variantLabel(ctx.db, it.variantId),
      quantity: qty,
      unitPrice: it.unitPrice,
    };
  });
  const id = nextId(ctx.db.returnRequests);
  const at = nowIso();
  const row: ReturnRequest = {
    id,
    code: `RT${String(11 + id).padStart(4, '0')}`,
    orderId: o.id,
    orderCode: o.orderCode,
    userId: ctx.user!.id,
    customerName: ctx.user!.fullName,
    items,
    type: b.type,
    reason: b.reason,
    description: String(b.description).trim(),
    images: b.images,
    refundAmount: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    status: 'pending',
    adminNote: null,
    createdAt: at,
    updatedAt: at,
  };
  ctx.db.returnRequests.push(row);
  notify(
    ctx.db,
    ctx.user!.id,
    `Đã nhận yêu cầu đổi trả ${row.code}`,
    'order',
    `Yêu cầu đổi trả cho đơn ${o.orderCode} đang chờ duyệt.`,
    '/account/returns',
  );
  return created(withReturnItemMeta(ctx.db, row));
}

void variantViews;
