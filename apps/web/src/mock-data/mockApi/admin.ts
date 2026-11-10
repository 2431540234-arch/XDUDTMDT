// Mock API: khu vực quản trị (/admin/*) – chỉ tài khoản role 'admin' (Doanh nghiệp)
import type { OrderStatus, ReviewStatus } from '@aurelia-living/shared-types';
import type {
  DashboardStats,
  Expense,
  FinanceReport,
  InventoryRow,
  Model3DAdminRow,
  ReturnRequest,
} from '@/types/api';
import { nextId, resetDb, type Db } from '../db';
import { modelFor, productSpecs, sizeSets } from '../tables/_products_spec';
import { slugify } from '@/lib/format';
import { cancelOrderCore, notify, placeOrderCore, withReturnItemMeta } from './shop';
import { settingsView } from './catalog';
import {
  ApiFail,
  type Body,
  created,
  done,
  inRange,
  fold,
  nowIso,
  notFound,
  ok,
  paginate,
  qList,
  qNum,
  qStr,
  sortBy,
  validation,
  type Ctx,
  type Result,
} from './http';
import {
  categoryTree,
  colorOfVariant,
  effectivePrice,
  mediaPath,
  model3DView,
  orderView,
  productDetail,
  productListItem,
  reviewView,
  spaceDetail,
  spaceListItem,
  userView,
  couponView,
  variantLabel,
  variantViews,
} from './views';

const ADMIN_ID = 1;
const log = (
  ctx: Ctx,
  action: string,
  targetType: string,
  targetId: number | null,
  changes: Record<string, unknown> | null = null,
) =>
  ctx.db.activityLogs.push({
    id: nextId(ctx.db.activityLogs),
    actorId: ADMIN_ID,
    action,
    targetType,
    targetId,
    changes: changes as never,
    ipAddress: '127.0.0.1',
    createdAt: nowIso(),
  });

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function mediaFrom(db: Db, url: string, name: string, mime = 'image/png', size = 500_000): number {
  const existing = db.media.find((m) => m.filePath === url);
  if (existing) return existing.id;
  const id = nextId(db.media);
  db.media.push({
    id,
    fileName: name,
    filePath: url,
    mimeType: mime,
    fileSize: size,
    altText: name,
    uploadedBy: ADMIN_ID,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return id;
}

// ===================== Tổng quan =====================
function rangeOf(ctx: Ctx, defFrom: string, defTo: string) {
  const from = qStr(ctx.query, 'from') || defFrom;
  const to = qStr(ctx.query, 'to') || defTo;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  const len = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  const prevEnd = new Date(start.getTime() - 1000);
  const prevStart = new Date(start.getTime() - len * DAY);
  return { from, to, start, end, prevStart, prevEnd };
}
const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
const between = (iso: string, a: Date, b: Date) => {
  const t = new Date(iso).getTime();
  return t >= a.getTime() && t <= b.getTime();
};
const recognized = (o: Db['orders'][number]) => o.status !== 'cancelled' && o.status !== 'refunded';

function topProducts(db: Db, orders: Db['orders'], n = 5) {
  const ids = new Set(orders.map((o) => o.id));
  const map = new Map<number, { sold: number; revenue: number }>();
  for (const it of db.orderItems) {
    if (!ids.has(it.orderId)) continue;
    const v = db.productVariants.find((x) => x.id === it.variantId);
    if (!v) continue;
    const cur = map.get(v.productId) ?? { sold: 0, revenue: 0 };
    cur.sold += it.quantity;
    cur.revenue += it.lineTotal ?? it.unitPrice * it.quantity;
    map.set(v.productId, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].sold - a[1].sold || b[1].revenue - a[1].revenue)
    .slice(0, n)
    .map(([productId, v]) => {
      const p = db.products.find((x) => x.id === productId)!;
      return {
        productId,
        name: p.name,
        slug: p.slug,
        imageUrl: mediaPath(
          db,
          db.productImages.find((i) => i.productId === productId && i.isPrimary)?.mediaId,
        ),
        sold: v.sold,
        revenue: v.revenue,
      };
    });
}

const activityText = (db: Db, a: Db['activityLogs'][number]): string => {
  const c = (a.changes ?? {}) as Record<string, unknown>;
  switch (a.action) {
    case 'order.create':
      return `đặt đơn hàng ${c.orderCode ?? `#${a.targetId}`}`;
    case 'review.create':
      return `đã đánh giá ${c.rating ?? ''} sao cho một sản phẩm`;
    case 'user.register':
      return 'đã đăng ký tài khoản mới';
    case 'order.update_status':
      return `cập nhật đơn hàng ${c.orderCode ?? ''}`;
    case 'product.update':
      return `cập nhật sản phẩm #${a.targetId}`;
    case 'product.create':
      return `thêm sản phẩm #${a.targetId}`;
    case 'coupon.create':
      return `tạo mã khuyến mãi ${c.code ?? ''}`;
    case 'review.approve':
      return 'duyệt một đánh giá';
    case 'model.upload':
      return `tải lên mô hình ${c.fileName ?? '3D'}`;
    default:
      return a.action;
  }
};

export function overview(ctx: Ctx): Result {
  const db = ctx.db;
  const { start, end, prevStart, prevEnd, from, to } = rangeOf(ctx, '2026-10-01', '2026-11-05');
  const cur = db.orders.filter((o) => between(o.createdAt, start, end));
  const prev = db.orders.filter((o) => between(o.createdAt, prevStart, prevEnd));
  const rev = (os: Db['orders']) => os.filter(recognized).reduce((s, o) => s + o.total, 0);
  const customers = db.users.filter((u) => u.id !== ADMIN_ID);
  const newCur = customers.filter((u) => between(u.createdAt, start, end)).length;
  const newPrev = customers.filter((u) => between(u.createdAt, prevStart, prevEnd)).length;
  const productsNow = db.products.filter((p) => p.status === 'published' && !p.deletedAt).length;
  const productsPrev = db.products.filter(
    (p) => p.status === 'published' && !p.deletedAt && new Date(p.createdAt) <= prevEnd,
  ).length;

  const days = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  const bucket = days > 92 ? 'month' : 'day';
  const series = new Map<string, { revenue: number; orders: number }>();
  if (bucket === 'day')
    for (let i = 0; i < days; i++)
      series.set(isoDay(new Date(start.getTime() + i * DAY)), { revenue: 0, orders: 0 });
  for (const o of cur) {
    const key = bucket === 'day' ? isoDay(new Date(o.createdAt)) : o.createdAt.slice(0, 7);
    const s = series.get(key) ?? { revenue: 0, orders: 0 };
    s.orders += 1;
    if (recognized(o)) s.revenue += o.total;
    series.set(key, s);
  }
  const statuses: OrderStatus[] = [
    'pending',
    'confirmed',
    'processing',
    'shipping',
    'completed',
    'cancelled',
    'refunded',
  ];
  const stats: DashboardStats = {
    totalOrders: cur.length,
    revenue: rev(cur),
    newCustomers: newCur,
    totalProducts: productsNow,
    deltas: {
      orders: pct(cur.length, prev.length),
      revenue: pct(rev(cur), rev(prev)),
      customers: pct(newCur, newPrev),
      products: pct(productsNow, productsPrev),
    },
    revenueSeries: [...series.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v })),
    statusBreakdown: statuses.map((status) => {
      const count = cur.filter((o) => o.status === status).length;
      return { status, count, percent: cur.length ? Math.round((count / cur.length) * 100) : 0 };
    }),
    recentOrders: [...db.orders]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((o) => orderView(db, o, { customer: true })),
    topProducts: topProducts(db, cur.filter(recognized)),
    recentActivity: [...db.activityLogs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((a) => {
        const actor = db.users.find((u) => u.id === a.actorId);
        return {
          ...a,
          actorName: actor?.fullName ?? 'Hệ thống',
          actorAvatarUrl: mediaPath(db, actor?.avatarMediaId),
          text: activityText(db, a),
        };
      }),
  };
  void from;
  void to;
  return ok(stats);
}

const EXPENSE_LABEL: Record<Expense['category'], string> = {
  cogs: 'Giá vốn hàng bán',
  shipping: 'Vận chuyển & lắp đặt',
  marketing: 'Marketing',
  payment_fee: 'Phí cổng thanh toán',
  refund: 'Hoàn tiền',
  other: 'Chi phí khác',
};

export function finance(ctx: Ctx): Result {
  const db = ctx.db;
  const { start, end, prevStart, prevEnd } = rangeOf(ctx, '2026-01-01', '2026-11-05');
  const incomeOf = (a: Date, b: Date) =>
    db.payments.filter(
      (p) => (p.status === 'success' || p.status === 'refunded') && p.paidAt && between(p.paidAt, a, b),
    );
  const expOf = (a: Date, b: Date) => db.expenses.filter((e) => between(e.date, a, b));
  const sum = (xs: Array<{ amount: number }>) => xs.reduce((s, x) => s + x.amount, 0);
  const inc = incomeOf(start, end);
  const exp = expOf(start, end);
  const totalIncome = sum(inc);
  const totalExpense = sum(exp);
  const profit = totalIncome - totalExpense;
  const prevInc = sum(incomeOf(prevStart, prevEnd));
  const prevExp = sum(expOf(prevStart, prevEnd));
  const margin = totalIncome ? Math.round((profit / totalIncome) * 1000) / 10 : 0;
  const prevMargin = prevInc ? ((prevInc - prevExp) / prevInc) * 100 : 0;

  const orderOf = (orderId: number) => db.orders.find((o) => o.id === orderId)!;
  const paidOrders = inc.map((p) => orderOf(p.orderId));
  const gross = paidOrders.reduce((s, o) => s + o.subtotal + o.shippingFee, 0);
  const discount = paidOrders.reduce((s, o) => s + o.discountAmount, 0);
  const refundedTotal = paidOrders.filter((o) => o.status === 'refunded').reduce((s, o) => s + o.total, 0);
  const cogs = sum(exp.filter((e) => e.category === 'cogs'));
  const opex = sum(exp.filter((e) => e.category !== 'cogs' && e.category !== 'refund'));
  const net = gross - discount - refundedTotal;

  const monthly = Array.from({ length: 12 }, (_, m) => {
    const a = new Date(Date.UTC(2026, m, 1));
    const b = new Date(Date.UTC(2026, m + 1, 0, 23, 59, 59));
    const income = sum(incomeOf(a, b));
    const expense = sum(expOf(a, b));
    return { month: `T${m + 1}`, income, expense, profit: income - expense };
  });
  const cats = (Object.keys(EXPENSE_LABEL) as Expense['category'][]).map((category) => {
    const amount = sum(exp.filter((e) => e.category === category));
    return {
      category,
      label: EXPENSE_LABEL[category],
      amount,
      percent: totalExpense ? Math.round((amount / totalExpense) * 100) : 0,
    };
  });
  const methods = new Map<string, number>();
  inc.forEach((p) => methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount));
  const methodLabel: Record<string, string> = {
    cod: 'COD',
    vnpay: 'VNPAY',
    momo: 'MoMo',
    zalopay: 'ZaloPay',
    bank_transfer: 'Chuyển khoản',
    card: 'Thẻ',
  };
  const byPaymentMethod = [...methods.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, amount]) => ({
      method: methodLabel[m] ?? m,
      amount,
      percent: totalIncome ? Math.round((amount / totalIncome) * 100) : 0,
    }));

  const catRev = new Map<string, number>();
  const paidIds = new Set(paidOrders.filter((o) => o.status !== 'refunded').map((o) => o.id));
  db.orderItems
    .filter((it) => paidIds.has(it.orderId))
    .forEach((it) => {
      const v = db.productVariants.find((x) => x.id === it.variantId);
      const p = v ? db.products.find((x) => x.id === v.productId) : null;
      const name = db.categories.find((c) => c.id === p?.categoryId)?.name ?? 'Khác';
      catRev.set(name, (catRev.get(name) ?? 0) + (it.lineTotal ?? 0));
    });
  const catSorted = [...catRev.entries()].sort((a, b) => b[1] - a[1]);
  const catTotal = catSorted.reduce((s, c) => s + c[1], 0) || 1;
  const top5 = catSorted.slice(0, 5);
  const rest = catSorted.slice(5).reduce((s, c) => s + c[1], 0);
  const byCategory = [...top5, ...(rest ? ([['Khác', rest]] as Array<[string, number]>) : [])].map(
    ([name, amount]) => ({ name, amount, percent: Math.round((amount / catTotal) * 100) }),
  );

  const dayCount = Math.min(31, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const dailyStart = new Date(end.getTime() - (dayCount - 1) * DAY);
  const daily = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(dailyStart.getTime() + i * DAY);
    const key = isoDay(d);
    return {
      date: key,
      revenue: db.orders
        .filter((o) => recognized(o) && o.createdAt.slice(0, 10) === key)
        .reduce((s, o) => s + o.total, 0),
    };
  });

  const ledger: FinanceReport['ledger'] = [
    ...inc.map((p) => ({
      date: p.paidAt!,
      code: `TH-${String(p.id).padStart(4, '0')}`,
      content: `Thu tiền đơn ${orderOf(p.orderId).orderCode} (${methodLabel[p.method] ?? p.method})`,
      type: 'income' as const,
      category: 'Doanh thu bán hàng',
      amount: p.amount,
    })),
    ...exp.map((e) => ({
      date: e.date,
      code: e.code,
      content: e.note,
      type: 'expense' as const,
      category: EXPENSE_LABEL[e.category],
      amount: -e.amount,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 150);

  const report: FinanceReport = {
    totalIncome,
    totalExpense,
    profit,
    margin,
    deltas: {
      income: pct(totalIncome, prevInc),
      expense: pct(totalExpense, prevExp),
      profit: pct(profit, prevInc - prevExp),
      margin: Math.round(margin - prevMargin),
    },
    monthly,
    expenseBreakdown: cats,
    byPaymentMethod,
    byCategory,
    daily,
    income: {
      gross,
      discountAndRefund: discount + refundedTotal,
      net,
      cogs,
      grossProfit: net - cogs,
      opex,
      profitBeforeTax: net - cogs - opex,
    },
    ledger,
    topProducts: topProducts(
      db,
      db.orders.filter((o) => recognized(o) && between(o.createdAt, start, end)),
    ),
  };
  return ok(report);
}

// ===================== Đơn hàng =====================
function orderFrom(ctx: Ctx) {
  const key = ctx.params.code ?? ctx.params.id;
  const o = ctx.db.orders.find((x) => x.orderCode === key || String(x.id) === key);
  if (!o) throw notFound('Đơn hàng');
  return o;
}

export function adminOrders(ctx: Ctx): Result {
  const q = ctx.query;
  const statuses = qList(q, 'status');
  const pay = qStr(q, 'paymentStatus');
  const search = fold(qStr(q, 'q'));
  let list = ctx.db.orders.filter(
    (o) =>
      (!statuses.length || statuses.includes(o.status)) &&
      (!pay || o.paymentStatus === pay) &&
      inRange(o.createdAt, qStr(q, 'from'), qStr(q, 'to')),
  );
  if (search) {
    list = list.filter((o) => {
      const u = ctx.db.users.find((x) => x.id === o.userId);
      return fold(
        `${o.orderCode} ${u?.fullName ?? ''} ${u?.email ?? ''} ${u?.phone ?? ''} ${o.recipientName}`,
      ).includes(search);
    });
  }
  list = sortBy(
    list,
    qStr(q, 'sort'),
    { createdAt: (o) => o.createdAt, total: (o) => o.total, orderCode: (o) => o.orderCode },
    'createdAt:desc',
  );
  return paginate(
    list.map((o) => orderView(ctx.db, o, { customer: true })),
    q,
    10,
  );
}

export function adminOrderCounts(ctx: Ctx): Result {
  const out: Record<string, number> = { all: ctx.db.orders.length };
  for (const s of ['pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded'])
    out[s] = ctx.db.orders.filter((o) => o.status === s).length;
  return ok(out);
}

export function adminCreateOrder(ctx: Ctx): Result {
  const db = ctx.db;
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  const user = db.users.find((u) => u.id === Number(b.userId) && u.id !== ADMIN_ID);
  if (!user) errs.userId = 'Vui lòng chọn khách hàng.';
  if (!Array.isArray(b.items) || !b.items.length) errs.items = 'Vui lòng thêm ít nhất một sản phẩm.';
  if (!b.paymentMethod) errs.paymentMethod = 'Vui lòng chọn phương thức thanh toán.';
  if (Object.keys(errs).length) throw validation(errs);
  const addr =
    db.addresses.find((a) => a.userId === user!.id && a.isDefault) ??
    db.addresses.find((a) => a.userId === user!.id);
  if (!addr) throw new ApiFail('BAD_REQUEST', 'Khách hàng chưa có địa chỉ giao hàng.');
  const lines = (b.items as Array<{ variantId: number; quantity: number }>).map((it) => {
    const v = db.productVariants.find((x) => x.id === Number(it.variantId));
    const p = v ? db.products.find((x) => x.id === v.productId) : null;
    if (!v || !p) throw notFound('Sản phẩm');
    const qty = Math.max(1, Math.floor(Number(it.quantity)));
    if (v.stockQuantity < qty)
      throw new ApiFail('OUT_OF_STOCK', `"${p.name}" chỉ còn ${v.stockQuantity} sản phẩm trong kho.`, {
        variantId: v.id,
        available: v.stockQuantity,
      });
    return { v, p, qty };
  });
  const order = placeOrderCore(
    db,
    user!,
    addr,
    b.paymentMethod,
    b.note ? String(b.note) : null,
    lines,
    undefined,
    ADMIN_ID,
  );
  return created(orderView(db, order, { customer: true }));
}

export const adminOrder = (ctx: Ctx): Result => ok(orderView(ctx.db, orderFrom(ctx), { customer: true }));

const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['completed'],
};

/** Hoàn tất đơn khi vận đơn delivered (UC-ADM-25): sold_count, COD đã thanh toán, lịch sử, thông báo */
function completeOrderMock(ctx: Ctx, o: Db['orders'][number], at: string) {
  const db = ctx.db;
  if (o.status !== 'shipping')
    throw new ApiFail(
      'INVALID_STATE',
      'Chỉ đánh dấu đã giao khi đơn đang ở trạng thái "Đang giao". Hãy chuyển đơn sang "Đang giao" trước.',
    );
  for (const it of db.orderItems.filter((x) => x.orderId === o.id && x.variantId)) {
    const v = db.productVariants.find((x) => x.id === it.variantId);
    const p = v && db.products.find((x) => x.id === v.productId);
    if (p) p.soldCount += it.quantity;
  }
  const pay = db.payments.find((p) => p.orderId === o.id);
  if (o.paymentMethod === 'cod' && pay && pay.status !== 'success') {
    pay.status = 'success';
    pay.paidAt = at;
    o.paymentStatus = 'paid';
  }
  o.status = 'completed';
  o.updatedAt = at;
  db.orderStatusHistory.push({
    id: nextId(db.orderStatusHistory),
    orderId: o.id,
    fromStatus: 'shipping',
    toStatus: 'completed',
    changedBy: ADMIN_ID,
    note: 'Giao hàng thành công',
    createdAt: at,
  });
  notify(
    db,
    o.userId,
    `Đơn ${o.orderCode} đã giao thành công`,
    'order',
    `Đơn hàng ${o.orderCode} đã được giao thành công.`,
    `/account/orders/${o.orderCode}`,
  );
}

export function setOrderStatus(ctx: Ctx): Result {
  const db = ctx.db;
  const o = orderFrom(ctx);
  const to = ctx.body?.status as OrderStatus;
  if (to === 'cancelled') return cancelOrder(ctx);
  if (to === 'completed') throw new ApiFail('INVALID_STATE', 'Hoàn tất khi vận đơn được đánh dấu đã giao.');
  if (!NEXT[o.status]?.includes(to))
    throw new ApiFail('INVALID_STATE', `Không thể chuyển đơn từ "${o.status}" sang "${to}".`);
  if (
    to === 'shipping' &&
    !db.shipments.some((s) => s.orderId === o.id && !['failed', 'returned'].includes(s.status))
  )
    throw new ApiFail('BAD_REQUEST', 'Cần tạo vận đơn trước khi chuyển đơn sang "Đang giao".', {
      shipment: ['Chưa có vận đơn.'],
    });
  const from = o.status;
  const at = nowIso();
  o.status = to;
  o.updatedAt = at;
  db.orderStatusHistory.push({
    id: nextId(db.orderStatusHistory),
    orderId: o.id,
    fromStatus: from,
    toStatus: to,
    changedBy: ADMIN_ID,
    note: ctx.body?.note ?? null,
    createdAt: at,
  });
  const label: Record<string, string> = {
    confirmed: 'đã được xác nhận',
    processing: 'đang được xử lý',
    shipping: 'đang được giao',
    completed: 'đã giao thành công',
  };
  notify(
    db,
    o.userId,
    `Đơn ${o.orderCode} ${label[to] ?? to}`,
    'order',
    `Trạng thái đơn hàng ${o.orderCode} đã cập nhật.`,
    `/account/orders/${o.orderCode}`,
  );
  log(ctx, 'order.update_status', 'order', o.id, { orderCode: o.orderCode, to });
  return ok(orderView(db, o, { customer: true }));
}

export function cancelOrder(ctx: Ctx): Result {
  const o = orderFrom(ctx);
  const reason = String(ctx.body?.reason ?? ctx.body?.note ?? '').trim();
  if (reason.length < 5 || reason.length > 500)
    throw validation({ reason: 'Lý do hủy đơn từ 5 đến 500 ký tự.' });
  cancelOrderCore(ctx.db, o.id, ADMIN_ID, reason, true);
  log(ctx, 'order.cancel', 'order', o.id, { orderCode: o.orderCode });
  return ok(orderView(ctx.db, o, { customer: true }));
}

export function refundOrder(ctx: Ctx): Result {
  const db = ctx.db;
  const o = orderFrom(ctx);
  if (!(o.status === 'completed' || (o.status === 'cancelled' && o.paymentStatus === 'paid')))
    throw new ApiFail('INVALID_STATE', 'Chỉ hoàn tiền cho đơn đã giao hoặc đơn đã hủy đã thanh toán.');
  const from = o.status;
  const at = nowIso();
  o.status = 'refunded';
  o.paymentStatus = 'refunded';
  o.updatedAt = at;
  const pay = db.payments.find((p) => p.orderId === o.id);
  if (pay) {
    pay.status = 'refunded';
    pay.updatedAt = at;
  }
  db.orderStatusHistory.push({
    id: nextId(db.orderStatusHistory),
    orderId: o.id,
    fromStatus: from,
    toStatus: 'refunded',
    changedBy: ADMIN_ID,
    note: 'Hoàn tiền thủ công',
    createdAt: at,
  });
  addExpense(db, 'refund', o.total, `Hoàn tiền đơn ${o.orderCode}`);
  notify(
    db,
    o.userId,
    `Đơn ${o.orderCode} đã được hoàn tiền`,
    'order',
    'Chúng tôi đã hoàn tiền cho đơn hàng của bạn.',
    `/account/orders/${o.orderCode}`,
  );
  return ok(orderView(db, o, { customer: true }));
}

const SHIP_NEXT: Record<string, string[]> = {
  pending: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed', 'returned'],
  failed: ['in_transit', 'returned'],
  delivered: [],
  returned: [],
};
const CARRIERS = ['ghn', 'ghtk', 'viettel_post', 'other'];

export function createShipment(ctx: Ctx): Result {
  const db = ctx.db;
  const o = orderFrom(ctx);
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (!CARRIERS.includes(String(b.carrier))) errs.carrier = 'Đơn vị vận chuyển không hợp lệ.';
  if (String(b.trackingCode ?? '').length > 100) errs.trackingCode = 'Mã vận đơn tối đa 100 ký tự.';
  if (b.fee !== undefined && b.fee !== '' && !(Number(b.fee) >= 0))
    errs.fee = 'Phí vận chuyển phải là số không âm.';
  if (Object.keys(errs).length) throw validation(errs);
  if (!['processing', 'shipping'].includes(o.status))
    throw new ApiFail('INVALID_STATE', 'Chỉ tạo vận đơn cho đơn đang "Đang xử lý" hoặc "Đang giao".');
  // failed còn giao lại được nên vẫn là vận đơn đang hoạt động; chỉ returned mới cho tạo vận đơn mới
  if (db.shipments.some((s) => s.orderId === o.id && s.status !== 'returned'))
    throw new ApiFail('INVALID_STATE', 'Đơn hàng đã có vận đơn đang hoạt động.');
  const at = nowIso();
  const sh = {
    id: nextId(db.shipments),
    orderId: o.id,
    carrier: b.carrier,
    trackingCode: String(b.trackingCode ?? '').trim() || null,
    status: 'pending',
    fee: b.fee !== undefined && b.fee !== '' ? Number(b.fee) : o.shippingFee,
    shippedAt: null,
    deliveredAt: null,
    createdAt: at,
    updatedAt: at,
  } as Db['shipments'][number];
  db.shipments.push(sh);
  log(ctx, 'shipment.create', 'shipment', sh.id, { orderCode: o.orderCode });
  return created({ shipment: sh, order: orderView(db, o, { customer: true }), warnings: [] });
}

export function updateShipmentStatus(ctx: Ctx): Result {
  const db = ctx.db;
  const sh = db.shipments.find((s) => s.id === Number(ctx.params.id));
  if (!sh) throw notFound('Vận đơn');
  const o = db.orders.find((x) => x.id === sh.orderId)!;
  const b = ctx.body ?? {};
  const to = b.status as string | undefined;
  if (to !== undefined && !(to in SHIP_NEXT))
    throw validation({ status: 'Trạng thái vận đơn không hợp lệ.' });
  const changing = to !== undefined && to !== sh.status;
  if (
    SHIP_NEXT[sh.status].length === 0 &&
    (changing || b.carrier || b.trackingCode !== undefined || b.fee !== undefined)
  )
    throw new ApiFail('INVALID_STATE', 'Vận đơn đã kết thúc, không thể cập nhật.');
  if (to && to !== sh.status && !SHIP_NEXT[sh.status].includes(to))
    throw new ApiFail('INVALID_STATE', `Không thể chuyển vận đơn từ "${sh.status}" sang "${to}".`);
  const at = nowIso();
  if (to === 'delivered') completeOrderMock(ctx, o, at); // lỗi ⇒ vận đơn giữ nguyên
  if (b.carrier && CARRIERS.includes(String(b.carrier))) sh.carrier = b.carrier;
  if (b.trackingCode !== undefined) sh.trackingCode = String(b.trackingCode).trim() || null;
  if (b.fee !== undefined && Number(b.fee) >= 0) sh.fee = Number(b.fee);
  if (to && to !== sh.status) {
    sh.status = to as typeof sh.status;
    if (to === 'picked_up') sh.shippedAt = at;
    if (to === 'delivered') {
      sh.deliveredAt = at;
      sh.shippedAt ??= at;
    }
  }
  sh.updatedAt = at;
  log(ctx, 'shipment.update_status', 'shipment', sh.id, { orderCode: o.orderCode, to });
  return ok({ shipment: sh, order: orderView(db, o, { customer: true }), warnings: [] });
}

export function confirmPayment(ctx: Ctx): Result {
  const db = ctx.db;
  const pay =
    db.payments.find((p) => p.id === Number(ctx.params.id)) ??
    db.payments.find((p) => p.orderId === Number(ctx.params.id));
  if (!pay) throw notFound('Giao dịch');
  const o = db.orders.find((x) => x.id === pay.orderId)!;
  if (o.paymentStatus === 'paid') throw new ApiFail('INVALID_STATE', 'Đơn hàng đã được thanh toán.');
  if (pay.method !== 'bank_transfer')
    throw new ApiFail('INVALID_STATE', 'Chỉ giao dịch chuyển khoản mới xác nhận thủ công.');
  if (pay.status !== 'pending' && !(o.status === 'cancelled' && pay.status === 'failed'))
    throw new ApiFail('INVALID_STATE', 'Chỉ giao dịch đang chờ mới xử lý được.');
  const code = String(ctx.body?.transactionCode ?? '').trim();
  if (code && db.payments.some((p) => p.id !== pay.id && p.transactionCode === code))
    throw new ApiFail('CONFLICT', 'Mã giao dịch đã được dùng cho giao dịch khác.');
  if (code) pay.transactionCode = code;
  pay.status = 'success';
  pay.paidAt = nowIso();
  pay.updatedAt = nowIso();
  o.paymentStatus = 'paid';
  if (o.status === 'pending') {
    o.status = 'confirmed';
    db.orderStatusHistory.push({
      id: nextId(db.orderStatusHistory),
      orderId: o.id,
      fromStatus: 'pending',
      toStatus: 'confirmed',
      changedBy: ADMIN_ID,
      note: 'Xác nhận đã nhận thanh toán',
      createdAt: nowIso(),
    });
  }
  return ok(orderView(db, o, { customer: true }));
}

export function failPayment(ctx: Ctx): Result {
  const db = ctx.db;
  const pay = db.payments.find((p) => p.id === Number(ctx.params.id));
  if (!pay) throw notFound('Giao dịch');
  const o = db.orders.find((x) => x.id === pay.orderId)!;
  if (pay.method !== 'bank_transfer' || pay.status !== 'pending' || o.paymentStatus === 'paid')
    throw new ApiFail('INVALID_STATE', 'Chỉ giao dịch chuyển khoản đang chờ mới đánh dấu thất bại được.');
  pay.status = 'failed';
  pay.updatedAt = nowIso();
  o.paymentStatus = 'failed';
  return ok(orderView(db, o, { customer: true }));
}

export function saveOrderNote(ctx: Ctx): Result {
  const o = orderFrom(ctx);
  ctx.db.orderNotes[o.id] = String(ctx.body?.note ?? '');
  return ok(orderView(ctx.db, o, { customer: true }));
}

function addExpense(db: Db, category: Expense['category'], amount: number, note: string) {
  const id = nextId(db.expenses);
  const row: Expense = {
    id,
    code: `CH-${String(id).padStart(4, '0')}`,
    category,
    amount: Math.round(amount),
    note,
    date: nowIso(),
  };
  db.expenses.push(row);
  return row;
}

export function createExpense(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (!['cogs', 'shipping', 'marketing', 'payment_fee', 'refund', 'other'].includes(b.category))
    errs.category = 'Vui lòng chọn danh mục chi.';
  if (!(Number(b.amount) > 0)) errs.amount = 'Số tiền phải lớn hơn 0.';
  if (!String(b.note ?? '').trim()) errs.note = 'Vui lòng nhập nội dung.';
  if (Object.keys(errs).length) throw validation(errs);
  const row = addExpense(ctx.db, b.category, Number(b.amount), String(b.note).trim());
  if (b.date) row.date = new Date(b.date).toISOString();
  return created(row);
}

// ===================== Đổi trả =====================
export function adminPayments(ctx: Ctx): Result {
  const { db, query: q } = ctx;
  const status = qStr(q, 'status');
  const method = qStr(q, 'method');
  const search = fold(qStr(q, 'q'));
  const list = db.payments
    .map((p) => {
      const o = db.orders.find((x) => x.id === p.orderId)!;
      const u = db.users.find((x) => x.id === o.userId);
      return {
        id: p.id,
        orderId: o.id,
        orderCode: o.orderCode,
        orderStatus: o.status,
        orderPaymentStatus: o.paymentStatus,
        customerName: u?.fullName ?? o.recipientName,
        customerEmail: u?.email ?? null,
        method: p.method,
        amount: Number(p.amount),
        status: p.status,
        transactionCode: p.transactionCode,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      };
    })
    .filter(
      (p) =>
        (!status || p.status === status) &&
        (!method || p.method === method) &&
        (!search || fold(`${p.orderCode} ${p.transactionCode ?? ''}`).includes(search)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return paginate(list, q, 10);
}

export function adminReturns(ctx: Ctx): Result {
  const q = ctx.query;
  const status = qStr(q, 'status');
  const type = qStr(q, 'type');
  const search = fold(qStr(q, 'q'));
  const list = ctx.db.returnRequests
    .filter(
      (r) =>
        (!status || r.status === status) &&
        (!type || r.type === type) &&
        (!search || fold(`${r.code} ${r.customerName} ${r.orderCode}`).includes(search)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => withReturnItemMeta(ctx.db, r));
  return paginate(list, q, 10);
}

export function updateReturn(ctx: Ctx): Result {
  const db = ctx.db;
  const r = db.returnRequests.find((x) => x.id === Number(ctx.params.id));
  if (!r) throw notFound('Yêu cầu đổi trả');
  const to = ctx.body?.status as ReturnRequest['status'];
  const flow: Record<string, ReturnRequest['status'][]> = {
    pending: ['picking', 'rejected'],
    picking: ['inspecting', 'rejected'],
    inspecting: ['refunded', 'exchanged', 'rejected'],
  };
  if (!flow[r.status]?.includes(to))
    throw new ApiFail('INVALID_STATE', 'Không thể chuyển yêu cầu sang trạng thái này.');
  if (to === 'rejected' && !String(ctx.body?.adminNote ?? '').trim())
    throw validation({ adminNote: 'Vui lòng nhập lý do từ chối.' });
  r.status = to;
  if (ctx.body?.adminNote !== undefined) r.adminNote = String(ctx.body.adminNote) || null;
  r.updatedAt = nowIso();
  if (to === 'refunded' || to === 'exchanged') {
    // Hoàn tiền: tạo phiếu chi "Hoàn tiền" và cộng lại tồn kho
    const o = db.orders.find((x) => x.id === r.orderId)!;
    for (const it of r.items) {
      const orderIt = db.orderItems.find(
        (x) =>
          x.orderId === o.id &&
          db.productVariants.find((v) => v.id === x.variantId)?.productId === it.productId,
      );
      const v = orderIt ? db.productVariants.find((x) => x.id === orderIt.variantId) : null;
      if (v) {
        v.stockQuantity += it.quantity;
        db.inventoryMovements.push({
          id: nextId(db.inventoryMovements),
          variantId: v.id,
          type: 'return',
          quantityChange: it.quantity,
          reason: `Nhập lại hàng đổi trả ${r.code}`,
          referenceCode: r.code,
          performedBy: ADMIN_ID,
          createdAt: nowIso(),
        });
      }
    }
    if (to === 'refunded')
      addExpense(db, 'refund', r.refundAmount, `Hoàn tiền đổi trả ${r.code} (đơn ${r.orderCode})`);
  }
  const label: Record<string, string> = {
    picking: 'được duyệt, chúng tôi sẽ sắp xếp lấy hàng',
    inspecting: 'đã nhận hàng và đang kiểm tra',
    refunded: 'đã được hoàn tiền',
    exchanged: 'đã được đổi sản phẩm',
    rejected: 'bị từ chối',
  };
  notify(
    db,
    r.userId,
    `Yêu cầu ${r.code} ${label[to] ?? to}`,
    'order',
    r.adminNote ?? 'Cập nhật yêu cầu đổi trả của bạn.',
    '/account/returns',
  );
  return ok(withReturnItemMeta(db, r));
}

// ===================== Khách hàng =====================
export function adminCustomers(ctx: Ctx): Result {
  const q = ctx.query;
  const search = fold(qStr(q, 'q'));
  const group = qStr(q, 'group');
  const status = qStr(q, 'status');
  let list = ctx.db.users.filter((u) => u.id !== ADMIN_ID && !u.deletedAt).map((u) => userView(ctx.db, u));
  if (search) list = list.filter((u) => fold(`${u.fullName} ${u.email} ${u.phone ?? ''}`).includes(search));
  if (group) list = list.filter((u) => u.customerGroup === group);
  if (status)
    list = list.filter((u) => (status === 'active' ? u.status === 'active' : u.status !== 'active'));
  list = sortBy(
    list,
    qStr(q, 'sort'),
    {
      fullName: (u) => u.fullName,
      totalOrders: (u) => u.totalOrders,
      totalSpent: (u) => u.totalSpent,
      createdAt: (u) => u.createdAt,
    },
    'createdAt:desc',
  );
  return paginate(list, q, 10);
}

function customerFrom(ctx: Ctx) {
  const u = ctx.db.users.find((x) => x.id === Number(ctx.params.id) && x.id !== ADMIN_ID);
  if (!u) throw notFound('Khách hàng');
  return u;
}

export function adminCustomer(ctx: Ctx): Result {
  const u = customerFrom(ctx);
  const db = ctx.db;
  const acts = db.activityLogs
    .filter((a) => a.actorId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((a) => ({ text: activityText(db, a), createdAt: a.createdAt }));
  return ok({
    ...userView(db, u),
    addresses: db.addresses
      .filter((a) => a.userId === u.id)
      .map((a) => ({ ...a, label: db.addressLabels[a.id] ?? 'Địa chỉ khác' })),
    recentActivity: acts,
  });
}

export function setCustomerStatus(ctx: Ctx): Result {
  const u = customerFrom(ctx);
  const s = ctx.body?.status;
  if (!['active', 'suspended'].includes(s)) throw validation({ status: 'Trạng thái không hợp lệ.' });
  u.status = s;
  log(ctx, 'user.update_status', 'user', u.id, { status: s });
  return ok(userView(ctx.db, u));
}

export function createCustomer(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  if (String(b.fullName ?? '').trim().length < 2) errs.fullName = 'Vui lòng nhập họ và tên.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email ?? ''))) errs.email = 'Email không hợp lệ.';
  if (!/^0\d{9}$/.test(String(b.phone ?? ''))) errs.phone = 'Số điện thoại phải gồm 10 chữ số.';
  if (Object.keys(errs).length) throw validation(errs);
  if (ctx.db.users.some((u) => u.email.toLowerCase() === String(b.email).toLowerCase()))
    throw new ApiFail('EMAIL_ALREADY_EXISTS', 'Email này đã tồn tại.');
  const id = nextId(ctx.db.users);
  const at = nowIso();
  ctx.db.users.push({
    id,
    uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    fullName: String(b.fullName).trim(),
    email: String(b.email).toLowerCase(),
    phone: b.phone,
    avatarMediaId: null,
    status: 'active',
    emailVerifiedAt: at,
    lastLoginAt: null,
    deletedAt: null,
    createdAt: at,
    updatedAt: at,
  });
  ctx.db.userRoles.push({ userId: id, roleId: 2, createdAt: at });
  ctx.db.userProfiles.push({
    userId: id,
    gender: b.gender ?? null,
    birthday: b.birthday ?? null,
    loyaltyPoints: 0,
    adminNote: null,
  });
  ctx.db.credentials[id] = '12345678';
  ctx.db.carts.push({ id: nextId(ctx.db.carts), userId: id, createdAt: at, updatedAt: at });
  log(ctx, 'user.create', 'user', id);
  return created(
    userView(
      ctx.db,
      ctx.db.users.find((u) => u.id === id)!,
    ),
  );
}

export function updateCustomer(ctx: Ctx): Result {
  const u = customerFrom(ctx);
  const b = ctx.body ?? {};
  if (b.fullName !== undefined) u.fullName = String(b.fullName).trim();
  if (b.phone !== undefined) u.phone = b.phone || null;
  const p = ctx.db.userProfiles.find((x) => x.userId === u.id);
  if (p && b.adminNote !== undefined) p.adminNote = b.adminNote || null;
  if (p && b.gender !== undefined) p.gender = b.gender;
  if (p && b.birthday !== undefined) p.birthday = b.birthday || null;
  u.updatedAt = nowIso();
  return ok(userView(ctx.db, u));
}

export function customerOrders(ctx: Ctx): Result {
  const u = customerFrom(ctx);
  return paginate(
    ctx.db.orders
      .filter((o) => o.userId === u.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((o) => orderView(ctx.db, o)),
    ctx.query,
    5,
  );
}
export const customerReviews = (ctx: Ctx): Result =>
  ok(ctx.db.reviews.filter((r) => r.userId === customerFrom(ctx).id).map((r) => reviewView(ctx.db, r)));
export const customerWishlist = (ctx: Ctx): Result =>
  ok(
    ctx.db.wishlists
      .filter((w) => w.userId === customerFrom(ctx).id)
      .map((w) =>
        productListItem(
          ctx.db,
          ctx.db.products.find((p) => p.id === w.productId)!,
        ),
      ),
  );

// ===================== Sản phẩm =====================
export function adminProducts(ctx: Ctx): Result {
  const q = ctx.query;
  const search = fold(qStr(q, 'q'));
  const cat = qStr(q, 'category');
  const status = qStr(q, 'status');
  let list = ctx.db.products.filter((p) => !p.deletedAt).map((p) => productListItem(ctx.db, p));
  if (search) list = list.filter((p) => fold(`${p.name} ${p.sku}`).includes(search));
  if (cat) {
    const ids = new Set([
      Number(cat),
      ...ctx.db.categories.filter((c) => c.parentId === Number(cat)).map((c) => c.id),
    ]);
    list = list.filter((p) => p.categoryId !== null && ids.has(p.categoryId));
  }
  if (status === 'selling') list = list.filter((p) => p.status === 'published' && p.stockQuantity > 0);
  else if (status === 'out') list = list.filter((p) => p.status === 'published' && p.stockQuantity <= 0);
  else if (status) list = list.filter((p) => p.status === status);
  list = sortBy(
    list,
    qStr(q, 'sort'),
    {
      name: (p) => p.name,
      price: (p) => p.salePrice ?? p.price,
      stockQuantity: (p) => p.stockQuantity,
      createdAt: (p) => p.createdAt,
    },
    'createdAt:desc',
  );
  return paginate(list, q, 10);
}

export function adminProduct(ctx: Ctx): Result {
  const p = ctx.db.products.find((x) => x.id === Number(ctx.params.id) && !x.deletedAt);
  if (!p) throw notFound('Sản phẩm');
  const detail = productDetail(ctx.db, p);
  return ok({ ...detail, allVariants: detail.variants });
}

interface VariantInput {
  id?: number;
  color?: { name: string; hex: string } | null;
  size?: string | null;
  sku: string;
  price: number;
  salePrice?: number | null;
  stockQuantity: number;
}

function ensureAttrValue(db: Db, attributeId: number, value: string, hex?: string) {
  let v = db.attributeValues.find((x) => x.attributeId === attributeId && x.value === value);
  if (!v) {
    v = { id: nextId(db.attributeValues), attributeId, value, createdAt: nowIso(), updatedAt: nowIso() };
    db.attributeValues.push(v);
  }
  if (hex) db.colorHexByValueId[v.id] = hex;
  return v.id;
}

function saveVariants(db: Db, productId: number, inputs: VariantInput[], material: string | null) {
  const keep = new Set<number>();
  for (const vi of inputs) {
    let v = vi.id ? db.productVariants.find((x) => x.id === vi.id && x.productId === productId) : undefined;
    if (!v) {
      v = {
        id: nextId(db.productVariants),
        productId,
        sku: vi.sku,
        price: vi.price,
        salePrice: vi.salePrice ?? null,
        stockQuantity: vi.stockQuantity,
        weightGram: null,
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.productVariants.push(v);
    } else
      Object.assign(v, {
        sku: vi.sku,
        price: vi.price,
        salePrice: vi.salePrice ?? null,
        stockQuantity: vi.stockQuantity,
        isActive: true,
        updatedAt: nowIso(),
      });
    keep.add(v.id);
    db.variantAttributeValues = db.variantAttributeValues.filter((x) => x.variantId !== v!.id);
    const link = (attributeId: number, valueId: number) =>
      db.variantAttributeValues.push({
        variantId: v!.id,
        attributeValueId: valueId,
        attributeId,
        createdAt: nowIso(),
      });
    if (vi.color) link(1, ensureAttrValue(db, 1, vi.color.name, vi.color.hex));
    link(2, ensureAttrValue(db, 2, vi.size || 'Tiêu chuẩn'));
    if (material) link(3, ensureAttrValue(db, 3, material));
  }
  db.productVariants
    .filter((v) => v.productId === productId && !keep.has(v.id))
    .forEach((v) => (v.isActive = false));
}

function validateProduct(b: Record<string, unknown>, creating: boolean) {
  const errs: Record<string, string> = {};
  if (String(b.name ?? '').trim().length < 2) errs.name = 'Vui lòng nhập tên sản phẩm.';
  if (creating && !String(b.sku ?? '').trim()) errs.sku = 'Vui lòng nhập SKU.';
  if (!b.categoryId) errs.categoryId = 'Vui lòng chọn danh mục.';
  if (!(Number(b.price) > 0)) errs.price = 'Giá bán phải lớn hơn 0.';
  if (Number(b.stock) < 0 || b.stock === '' || b.stock === undefined) errs.stock = 'Vui lòng nhập tồn kho.';
  if (!String(b.shortDescription ?? '').trim()) errs.shortDescription = 'Vui lòng nhập mô tả ngắn.';
  if (Object.keys(errs).length) throw validation(errs);
}

function applyProductBody(ctx: Ctx, p: Db['products'][number], b: Body) {
  const db = ctx.db;
  p.name = String(b.name).trim();
  if (b.slug) p.slug = slugify(String(b.slug));
  p.categoryId = Number(b.categoryId);
  p.brandId = b.brandId ? Number(b.brandId) : null;
  p.status = b.status ?? 'published';
  p.isFeatured = Boolean(b.isFeatured);
  p.shortDescription = String(b.shortDescription ?? '');
  p.description = String(b.description ?? '');
  p.metaTitle = b.metaTitle || null;
  p.metaDescription = b.metaDescription || null;
  p.updatedAt = nowIso();
  // Biến thể
  const material = b.material ? String(b.material) : null;
  const variants: VariantInput[] =
    Array.isArray(b.variants) && b.variants.length
      ? b.variants
      : [
          {
            id: db.productVariants.find((v) => v.productId === p.id && v.isActive)?.id,
            sku: String(b.sku),
            price: Number(b.originalPrice) > Number(b.price) ? Number(b.originalPrice) : Number(b.price),
            salePrice: Number(b.originalPrice) > Number(b.price) ? Number(b.price) : null,
            stockQuantity: Number(b.stock),
            color: null,
            size: null,
          },
        ];
  saveVariants(db, p.id, variants, material);
  // Ảnh
  if (Array.isArray(b.images)) {
    db.productImages = db.productImages.filter((i) => i.productId !== p.id);
    (b.images as Array<{ url: string; isPrimary?: boolean }>).forEach((im, idx) => {
      db.productImages.push({
        id: nextId(db.productImages),
        productId: p.id,
        variantId: null,
        mediaId: mediaFrom(db, im.url, `${p.slug}-${idx + 1}.png`),
        sortOrder: idx + 1,
        isPrimary: Boolean(im.isPrimary) || idx === 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });
  }
  // Mở rộng (chưa có trong DB)
  let ex = db.productExtras.find((e) => e.productId === p.id);
  if (!ex) {
    ex = {
      productId: p.id,
      style: '',
      costPrice: 0,
      costRatio: 0.62,
      dims: [1000, 800, 800],
      sizeDimMult: {},
      minStock: 5,
      features: [],
      specs: [],
      type: 'sofa',
      modelKey: null,
    };
    db.productExtras.push(ex);
  }
  if (b.style !== undefined) ex.style = String(b.style);
  if (Array.isArray(b.specs)) ex.specs = b.specs;
  if (Array.isArray(b.features)) ex.features = b.features;
  if (b.costPrice !== undefined) ex.costPrice = Number(b.costPrice) || 0;
}

export function createProduct(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  validateProduct(b, true);
  const name = String(b.name).trim();
  let slug = slugify(String(b.slug || name));
  if (ctx.db.products.some((p) => p.slug === slug)) slug = `${slug}-${ctx.db.products.length + 1}`;
  if (ctx.db.productVariants.some((v) => v.sku === b.sku))
    throw new ApiFail('CONFLICT', 'SKU đã tồn tại.', { fields: ['sku'] });
  const id = nextId(ctx.db.products);
  const at = nowIso();
  const p: Db['products'][number] = {
    id,
    name,
    slug,
    shortDescription: null,
    description: null,
    categoryId: null,
    brandId: null,
    status: 'published',
    isFeatured: false,
    ratingAvg: 0,
    ratingCount: 0,
    soldCount: 0,
    has3dModel: false,
    metaTitle: null,
    metaDescription: null,
    deletedAt: null,
    createdAt: at,
    updatedAt: at,
  };
  ctx.db.products.push(p);
  applyProductBody(ctx, p, { ...b, slug });
  log(ctx, 'product.create', 'product', id, { name });
  return created(productDetail(ctx.db, p));
}

export function updateProduct(ctx: Ctx): Result {
  const p = ctx.db.products.find((x) => x.id === Number(ctx.params.id) && !x.deletedAt);
  if (!p) throw notFound('Sản phẩm');
  const b = { ...ctx.body };
  validateProduct({ sku: 'x', ...b }, false);
  applyProductBody(ctx, p, b);
  log(ctx, 'product.update', 'product', p.id, { name: p.name });
  return ok(productDetail(ctx.db, p));
}

export function deleteProduct(ctx: Ctx): Result {
  const p = ctx.db.products.find((x) => x.id === Number(ctx.params.id) && !x.deletedAt);
  if (!p) throw notFound('Sản phẩm');
  p.deletedAt = nowIso(); // xóa mềm (D-D05)
  ctx.db.wishlists = ctx.db.wishlists.filter((w) => w.productId !== p.id);
  log(ctx, 'product.delete', 'product', p.id);
  return done();
}

// ===================== Ảnh 360° của sản phẩm (TODO: cần thêm vào DB/API) =====================
export function adminProduct360(ctx: Ctx): Result {
  const p = ctx.db.products.find((x) => x.id === Number(ctx.params.id) && !x.deletedAt);
  if (!p) throw notFound('Sản phẩm');
  const cfg = ctx.db.product360.find((x) => x.productId === p.id);
  const frames = ctx.db.product360Frames.filter((f) => f.productId === p.id);
  const variantColors = variantViews(ctx.db, p.id)
    .flatMap((v) => (v.color ? [v.color] : []))
    .filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i);
  return ok({
    enabled: Boolean(cfg?.enabled),
    frameCount: cfg?.frameCount ?? 36,
    autoRotate: cfg?.autoRotate ?? true,
    colors: frames.map((f) => ({ name: f.colorName, hex: f.colorHex, frames: f.frames })),
    variantColors,
  });
}

export function saveProduct360(ctx: Ctx): Result {
  const db = ctx.db;
  const p = db.products.find((x) => x.id === Number(ctx.params.id) && !x.deletedAt);
  if (!p) throw notFound('Sản phẩm');
  const b = ctx.body ?? {};
  const colors = (Array.isArray(b.colors) ? b.colors : []) as Array<{
    name: string;
    hex: string;
    frames: string[];
  }>;
  if (b.enabled && !colors.some((c) => c.frames.length >= 2))
    throw validation({ colors: 'Cần ít nhất một màu có từ 2 ảnh trở lên để bật xem 360°.' });
  const frameCount = colors.find((c) => c.frames.length)?.frames.length ?? 36;
  let cfg = db.product360.find((x) => x.productId === p.id);
  const defColor = colors.find((c) => c.frames.length);
  const defId = defColor ? ensureAttrValue(db, 1, defColor.name, defColor.hex) : 0;
  if (!cfg) {
    cfg = {
      productId: p.id,
      enabled: false,
      frameCount,
      defaultColorId: defId,
      autoRotate: true,
      rotationSpeed: 8,
    };
    db.product360.push(cfg);
  }
  Object.assign(cfg, {
    enabled: Boolean(b.enabled),
    frameCount,
    autoRotate: b.autoRotate !== false,
    defaultColorId: defId || cfg.defaultColorId,
  });
  db.product360Frames = db.product360Frames.filter((f) => f.productId !== p.id);
  for (const c of colors.filter((x) => x.frames.length)) {
    db.product360Frames.push({
      productId: p.id,
      colorId: ensureAttrValue(db, 1, c.name, c.hex),
      colorName: c.name,
      colorHex: c.hex,
      frames: c.frames,
      thumbnail: c.frames[0],
    });
  }
  log(ctx, 'product.update_360', 'product', p.id, { enabled: cfg.enabled });
  return adminProduct360(ctx);
}

// ===================== Danh mục =====================
export const adminCategories = (ctx: Ctx): Result => ok(categoryTree(ctx.db, true));

function validateCategory(ctx: Ctx, b: Body, selfId?: number) {
  const errs: Record<string, string> = {};
  if (String(b.name ?? '').trim().length < 2) errs.name = 'Vui lòng nhập tên danh mục.';
  const slug = slugify(String(b.slug || b.name || ''));
  if (!slug) errs.slug = 'Slug không hợp lệ.';
  else if (ctx.db.categories.some((c) => c.slug === slug && c.id !== selfId)) errs.slug = 'Slug đã tồn tại.';
  if (b.parentId && ctx.db.categories.find((c) => c.id === Number(b.parentId))?.parentId)
    errs.parentId = 'Chỉ hỗ trợ danh mục 2 cấp.';
  if (Object.keys(errs).length) throw validation(errs);
  return slug;
}

export function createCategory(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const slug = validateCategory(ctx, b);
  const id = nextId(ctx.db.categories);
  const at = nowIso();
  ctx.db.categories.push({
    id,
    parentId: b.parentId ? Number(b.parentId) : null,
    name: String(b.name).trim(),
    slug,
    imageMediaId: b.imageUrl ? mediaFrom(ctx.db, b.imageUrl, `category-${slug}.png`) : null,
    sortOrder: Number(b.sortOrder) || id,
    isActive: b.isActive !== false,
    metaTitle: null,
    metaDescription: null,
    createdAt: at,
    updatedAt: at,
  });
  ctx.db.categoryExtras[id] = {
    description: b.description ?? '',
    isFeatured: Boolean(b.isFeatured),
    type: null,
  };
  log(ctx, 'category.create', 'category', id);
  return created(
    categoryTree(ctx.db, true)
      .flatMap((r) => [r, ...r.children])
      .find((c) => c.id === id),
  );
}

export function updateCategory(ctx: Ctx): Result {
  const c = ctx.db.categories.find((x) => x.id === Number(ctx.params.id));
  if (!c) throw notFound('Danh mục');
  const b = { ...c, ...ctx.body };
  const slug = validateCategory(ctx, b, c.id);
  if (Number(b.parentId) === c.id) throw validation({ parentId: 'Danh mục cha không hợp lệ.' });
  Object.assign(c, {
    name: String(b.name).trim(),
    slug,
    parentId: b.parentId ? Number(b.parentId) : null,
    sortOrder: Number(b.sortOrder) || c.sortOrder,
    isActive: b.isActive !== false,
    updatedAt: nowIso(),
  });
  if (ctx.body?.imageUrl) c.imageMediaId = mediaFrom(ctx.db, ctx.body.imageUrl, `category-${slug}.png`);
  const ex = (ctx.db.categoryExtras[c.id] ??= { description: '', isFeatured: false, type: null });
  if (ctx.body?.description !== undefined) ex.description = ctx.body.description;
  if (ctx.body?.isFeatured !== undefined) ex.isFeatured = Boolean(ctx.body.isFeatured);
  return ok(
    categoryTree(ctx.db, true)
      .flatMap((r) => [r, ...r.children])
      .find((x) => x.id === c.id),
  );
}

export function deleteCategory(ctx: Ctx): Result {
  const c = ctx.db.categories.find((x) => x.id === Number(ctx.params.id));
  if (!c) throw notFound('Danh mục');
  if (
    ctx.db.categories.some((x) => x.parentId === c.id) ||
    ctx.db.products.some((p) => p.categoryId === c.id && !p.deletedAt)
  )
    throw new ApiFail('RESOURCE_IN_USE', 'Danh mục đang có sản phẩm hoặc danh mục con, không thể xóa.');
  ctx.db.categories.splice(ctx.db.categories.indexOf(c), 1);
  return done();
}

// ===================== Đánh giá, hỏi đáp =====================
export function adminReviews(ctx: Ctx): Result {
  const q = ctx.query;
  const search = fold(qStr(q, 'q'));
  const status = qStr(q, 'status');
  const productId = qNum(q, 'productId', 0);
  let list = ctx.db.reviews
    .filter((r) => (!status || r.status === status) && (!productId || r.productId === productId))
    .map((r) => reviewView(ctx.db, r));
  if (search)
    list = list.filter((r) => fold(`${r.productName} ${r.userName} ${r.content ?? ''}`).includes(search));
  list = sortBy(
    list,
    qStr(q, 'sort'),
    { createdAt: (r) => r.createdAt, rating: (r) => r.rating },
    'createdAt:desc',
  );
  return paginate(list, q, 10);
}

export function setReviewStatus(ctx: Ctx): Result {
  const r = ctx.db.reviews.find((x) => x.id === Number(ctx.params.id));
  if (!r) throw notFound('Đánh giá');
  const s = ctx.body?.status as ReviewStatus;
  if (!['pending', 'approved', 'rejected'].includes(s))
    throw validation({ status: 'Trạng thái không hợp lệ.' });
  r.status = s;
  r.updatedAt = nowIso();
  const p = ctx.db.products.find((x) => x.id === r.productId)!;
  const approved = ctx.db.reviews.filter((x) => x.productId === p.id && x.status === 'approved');
  p.ratingCount = approved.length;
  p.ratingAvg = approved.length
    ? Math.round((approved.reduce((a, x) => a + x.rating, 0) / approved.length) * 10) / 10
    : 0;
  log(ctx, s === 'approved' ? 'review.approve' : 'review.reject', 'review', r.id);
  return ok(reviewView(ctx.db, r));
}

export function adminQuestions(ctx: Ctx): Result {
  const q = ctx.query;
  const status = qStr(q, 'status');
  const search = fold(qStr(q, 'q'));
  const list = ctx.db.productQuestions
    .filter(
      (x) =>
        (!status || x.status === status) &&
        (!search || fold(`${x.productName} ${x.userName} ${x.content}`).includes(search)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((x) => ({
      ...x,
      productImageUrl: mediaPath(
        ctx.db,
        ctx.db.productImages.find((i) => i.productId === x.productId && i.isPrimary)?.mediaId,
      ),
    }));
  return paginate(list, q, 10);
}

export function answerQuestion(ctx: Ctx): Result {
  const x = ctx.db.productQuestions.find((y) => y.id === Number(ctx.params.id));
  if (!x) throw notFound('Câu hỏi');
  const b = ctx.body ?? {};
  if (b.status === 'hidden') {
    x.status = 'hidden';
    x.isPublic = false;
  } else {
    if (String(b.answer ?? '').trim().length < 5)
      throw validation({ answer: 'Câu trả lời tối thiểu 5 ký tự.' });
    x.answer = String(b.answer).trim();
    x.answeredBy = 'Aurelia Living';
    x.answeredAt = nowIso();
    x.isPublic = b.isPublic !== false;
    x.status = 'answered';
    notify(
      ctx.db,
      x.userId,
      'Câu hỏi của bạn đã được trả lời',
      'system',
      `Aurelia Living đã trả lời câu hỏi về "${x.productName}".`,
      `/products/${x.productSlug}`,
    );
  }
  return ok(x);
}

// ===================== Mô hình 3D =====================
function modelRows(db: Db): Model3DAdminRow[] {
  const rows: Model3DAdminRow[] = [];
  for (const f of db.modelFiles) {
    const m = db.product3dModels.find((x) => x.id === f.modelId);
    if (!m) continue;
    const md = db.media.find((x) => x.id === f.mediaId)!;
    const p = db.products.find((x) => x.id === m.productId)!;
    rows.push({
      ...model3DView(db, m),
      id: f.id, // id dòng = id của tệp
      modelId: m.id,
      fileId: f.id,
      failureReason: null,
      lod: f.lod,
      productName: p.name,
      productThumbnailUrl: mediaPath(
        db,
        db.productImages.find((i) => i.productId === p.id && i.isPrimary)?.mediaId,
      ),
      format: 'glb' as const,
      fileName: md.fileName,
      sizeMB: Math.round((md.fileSize / 1024 / 1024) * 10) / 10,
      uploadedAt: f.createdAt,
      glbUrl: f.format === 'glb' ? md.filePath : model3DView(db, m).glbUrl,
    });
  }
  return rows;
}

export function adminModels(ctx: Ctx): Result {
  const q = ctx.query;
  const productId = qNum(q, 'productId', 0);
  const format = qStr(q, 'format');
  const search = fold(qStr(q, 'q'));
  let list = modelRows(ctx.db).filter(
    (r) =>
      (!productId || r.productId === productId) &&
      (!format || r.format === format) &&
      (!search || fold(`${r.fileName} ${r.productName}`).includes(search)),
  );
  list = sortBy(
    list,
    qStr(q, 'sort'),
    { uploadedAt: (r) => r.uploadedAt, sizeMB: (r) => r.sizeMB, fileName: (r) => r.fileName },
    'uploadedAt:desc',
  );
  return paginate(list, q, 10);
}

export function uploadModel(ctx: Ctx): Result {
  const db = ctx.db;
  const b = ctx.body ?? {};
  const errs: Record<string, string> = {};
  const p = db.products.find((x) => x.id === Number(b.productId));
  if (!p) errs.productId = 'Vui lòng chọn sản phẩm liên kết.';
  if (b.format !== 'glb') errs.format = 'Hệ thống chỉ hỗ trợ tệp GLB';
  if (!(Number(b.sizeMB) > 0) || Number(b.sizeMB) > 50) errs.file = 'Tệp phải nhỏ hơn hoặc bằng 50MB.';
  if (Object.keys(errs).length) throw validation(errs);
  let m = db.product3dModels.find((x) => x.productId === p!.id && x.isPrimary);
  const at = nowIso();
  if (!m) {
    const ex = db.productExtras.find((e) => e.productId === p!.id);
    const spec = productSpecs.find((s) => s.name === p!.name);
    const [l, w, h] = spec?.dims ?? [1000, 800, 800];
    m = {
      id: nextId(db.product3dModels),
      uuid: `10000000-0000-4000-8000-${String(nextId(db.product3dModels)).padStart(12, '0')}`,
      productId: p!.id,
      variantId: null,
      lengthMm: l,
      widthMm: w,
      heightMm: h,
      placement: 'floor',
      allowScaling: true,
      viewerConfig: { autoRotate: true, exposure: 1 },
      posterMediaId: db.productImages.find((i) => i.productId === p!.id && i.isPrimary)?.mediaId ?? null,
      status: 'ready',
      version: 1,
      isPrimary: true,
      createdAt: at,
      updatedAt: at,
    };
    db.product3dModels.push(m);
    void ex;
  }
  const spec = productSpecs.find((s) => s.name === p!.name);
  const modelKey = (spec && modelFor(spec)) ?? 'sofa';
  const filePath = `/mock/models/${modelKey}.glb?u=${Date.now()}`;
  const mediaId = mediaFrom(
    db,
    filePath,
    String(b.fileName),
    'model/gltf-binary',
    Math.round(Number(b.sizeMB) * 1024 * 1024),
  );
  const f = {
    id: nextId(db.modelFiles),
    modelId: m.id,
    format: 'glb' as const,
    lod: 'high' as const,
    mediaId,
    polygonCount: b.format === 'glb' ? 42_000 : null,
    textureResolution: 2048,
    isCompressed: true,
    checksum: `sha256-${Date.now().toString(16)}`,
    createdAt: at,
    updatedAt: at,
  };
  db.modelFiles.push(f);
  p!.has3dModel = true;
  log(ctx, 'model.upload', 'product3dmodel', m.id, { fileName: b.fileName });
  return created(modelRows(db).find((r) => r.id === f.id));
}

/** Mock: mô hình luôn ready (không có hàng đợi), nên chỉ trả kết quả hợp lệ để giao diện không lỗi */
export function reprocessModel(ctx: Ctx): Result {
  const m = ctx.db.product3dModels.find((x) => x.id === Number(ctx.params.id));
  if (!m) throw notFound('Mô hình');
  if (m.status !== 'failed')
    throw new ApiFail('INVALID_STATE', 'Chỉ xử lý lại được mô hình đang ở trạng thái lỗi.');
  m.status = 'ready';
  return ok({ modelId: m.id, jobId: 'mock', status: 'processing' });
}

export function setPrimaryModel(ctx: Ctx): Result {
  const db = ctx.db;
  const m = db.product3dModels.find((x) => x.id === Number(ctx.params.id));
  if (!m) throw notFound('Mô hình');
  if (m.status !== 'ready')
    throw new ApiFail('INVALID_STATE', 'Chỉ đặt làm mô hình chính khi mô hình đã xử lý xong (ready).');
  for (const x of db.product3dModels) if (x.productId === m.productId) x.isPrimary = x.id === m.id;
  return ok({ modelId: m.id, productId: m.productId, isPrimary: true });
}

export function deleteModelById(ctx: Ctx): Result {
  const db = ctx.db;
  const m = db.product3dModels.find((x) => x.id === Number(ctx.params.modelId));
  if (!m) throw notFound('Mô hình');
  db.modelFiles = db.modelFiles.filter((x) => x.modelId !== m.id);
  db.product3dModels.splice(db.product3dModels.indexOf(m), 1);
  return done();
}

export function deleteModel(ctx: Ctx): Result {
  const db = ctx.db;
  const f = db.modelFiles.find((x) => x.id === Number(ctx.params.id));
  if (!f) throw notFound('Mô hình');
  db.modelFiles.splice(db.modelFiles.indexOf(f), 1);
  if (!db.modelFiles.some((x) => x.modelId === f.modelId)) {
    const m = db.product3dModels.find((x) => x.id === f.modelId);
    if (m) {
      db.product3dModels.splice(db.product3dModels.indexOf(m), 1);
      const p = db.products.find((x) => x.id === m.productId);
      if (p) {
        p.has3dModel = false;
      }
    }
  }
  return done();
}

// ===================== Khuyến mãi =====================
export function adminCoupons(ctx: Ctx): Result {
  const q = ctx.query;
  const tab = qStr(q, 'tab');
  const kind = qStr(q, 'kind');
  const search = fold(qStr(q, 'q'));
  const t = new Date();
  const state = (c: Db['coupons'][number]) =>
    !c.isActive || (c.endsAt && new Date(c.endsAt) < t)
      ? 'ended'
      : new Date(c.startsAt) > t
        ? 'upcoming'
        : 'active';
  let list = ctx.db.coupons.map((c) => couponView(ctx.db, c));
  const counts = {
    all: list.length,
    active: list.filter((c) => state(c) === 'active').length,
    upcoming: list.filter((c) => state(c) === 'upcoming').length,
    ended: list.filter((c) => state(c) === 'ended').length,
  };
  if (tab && tab !== 'all') list = list.filter((c) => state(c) === tab);
  if (kind) list = list.filter((c) => c.kind === kind);
  if (search) list = list.filter((c) => fold(`${c.code} ${c.name}`).includes(search));
  list = sortBy(
    list,
    qStr(q, 'sort'),
    { code: (c) => c.code, startsAt: (c) => c.startsAt, usedCount: (c) => c.usedCount },
    'startsAt:desc',
  );
  const res = paginate(list, q, 10);
  return { ...res, data: res.data, meta: { ...res.meta!, ...(counts as object) } as never };
}

export const adminCoupon = (ctx: Ctx): Result => {
  const c = ctx.db.coupons.find((x) => x.id === Number(ctx.params.id));
  if (!c) throw notFound('Khuyến mãi');
  return ok(couponView(ctx.db, c));
};

function validateCoupon(ctx: Ctx, b: Body, selfId?: number) {
  const errs: Record<string, string> = {};
  if (String(b.name ?? '').trim().length < 2) errs.name = 'Vui lòng nhập tên chương trình.';
  const code = String(b.code ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9_-]{4,20}$/.test(code)) errs.code = 'Mã gồm 4–20 ký tự chữ in hoa hoặc số.';
  else if (ctx.db.coupons.some((c) => c.code === code && c.id !== selfId))
    errs.code = 'Mã khuyến mãi đã tồn tại.';
  if (!['percent', 'fixed', 'freeship'].includes(b.kind)) errs.kind = 'Vui lòng chọn loại giảm giá.';
  if (b.kind === 'percent' && !(Number(b.value) > 0 && Number(b.value) <= 100))
    errs.value = 'Phần trăm giảm từ 1 đến 100.';
  if (b.kind === 'fixed' && !(Number(b.value) > 0)) errs.value = 'Giá trị giảm phải lớn hơn 0.';
  if (!b.startsAt) errs.startsAt = 'Vui lòng chọn ngày bắt đầu.';
  if (!b.endsAt) errs.endsAt = 'Vui lòng chọn ngày kết thúc.';
  else if (b.startsAt && new Date(b.endsAt) < new Date(b.startsAt))
    errs.endsAt = 'Ngày kết thúc phải sau ngày bắt đầu.';
  if (Object.keys(errs).length) throw validation(errs);
  return code;
}

function saveCoupon(ctx: Ctx, c: Db['coupons'][number] | null, b: Body) {
  const code = validateCoupon(ctx, b, c?.id);
  const db = ctx.db;
  const at = nowIso();
  const row =
    c ??
    (() => {
      const r = {
        id: nextId(db.coupons),
        code,
        type: 'fixed' as const,
        value: 0,
        maxDiscount: null,
        minOrderValue: 0,
        usageLimit: null,
        perUserLimit: null,
        usedCount: 0,
        startsAt: at,
        endsAt: null,
        isActive: true,
        createdAt: at,
        updatedAt: at,
      };
      db.coupons.push(r);
      return r;
    })();
  Object.assign(row, {
    code,
    type: b.kind === 'percent' ? 'percent' : 'fixed',
    value: b.kind === 'freeship' ? 0 : Number(b.value),
    maxDiscount: b.maxDiscount ? Number(b.maxDiscount) : null,
    minOrderValue: Number(b.minOrderValue) || 0,
    usageLimit: b.usageLimit ? Number(b.usageLimit) : null,
    perUserLimit: b.perUserLimit ? Number(b.perUserLimit) : null,
    startsAt: new Date(b.startsAt).toISOString(),
    endsAt: new Date(b.endsAt).toISOString(),
    isActive: b.isActive !== false,
    updatedAt: at,
  });
  const scopeIds: number[] = Array.isArray(b.categoryIds) ? b.categoryIds.map(Number) : [];
  const labels: Record<string, string> = {
    all: 'Tất cả sản phẩm',
    category: scopeIds.length
      ? `Danh mục: ${scopeIds
          .map((id) => db.categories.find((c2) => c2.id === id)?.name)
          .filter(Boolean)
          .join(', ')}`
      : 'Theo danh mục',
    product: 'Theo sản phẩm',
    space: 'Theo không gian mẫu',
  };
  const appliesTo = b.appliesTo ?? 'all';
  const extra = {
    couponId: row.id,
    name: String(b.name).trim(),
    description: String(b.description ?? ''),
    kind: b.kind,
    appliesTo,
    appliesToLabel: labels[appliesTo] ?? 'Tất cả sản phẩm',
    categoryIds: appliesTo === 'category' ? scopeIds : [],
  };
  const idx = db.couponExtras.findIndex((e) => e.couponId === row.id);
  if (idx >= 0) db.couponExtras[idx] = extra;
  else db.couponExtras.push(extra);
  return row;
}

export function createCoupon(ctx: Ctx): Result {
  const row = saveCoupon(ctx, null, ctx.body ?? {});
  log(ctx, 'coupon.create', 'coupon', row.id, { code: row.code });
  return created(couponView(ctx.db, row));
}

export function updateCoupon(ctx: Ctx): Result {
  const c = ctx.db.coupons.find((x) => x.id === Number(ctx.params.id));
  if (!c) throw notFound('Khuyến mãi');
  const cur = couponView(ctx.db, c);
  const merged = { ...cur, kind: cur.kind, ...ctx.body };
  const row = saveCoupon(ctx, c, merged);
  return ok(couponView(ctx.db, row));
}

export function deleteCoupon(ctx: Ctx): Result {
  const c = ctx.db.coupons.find((x) => x.id === Number(ctx.params.id));
  if (!c) throw notFound('Khuyến mãi');
  if (ctx.db.couponUsages.some((u) => u.couponId === c.id)) {
    c.isActive = false; // đã được dùng → chỉ ngừng kích hoạt
    return ok(couponView(ctx.db, c));
  }
  ctx.db.coupons.splice(ctx.db.coupons.indexOf(c), 1);
  return done();
}

// ===================== Không gian mẫu =====================
export function adminSpaces(ctx: Ctx): Result {
  const q = ctx.query;
  const search = fold(qStr(q, 'q'));
  const room = qStr(q, 'roomType');
  const status = qStr(q, 'status');
  let list = ctx.db.spaces
    .filter(
      (s) =>
        (!room || s.roomType === room) &&
        (!status || s.status === status) &&
        (!search || fold(`${s.title} ${s.style ?? ''}`).includes(search)),
    )
    .map((s) => spaceListItem(ctx.db, s));
  list = sortBy(
    list,
    qStr(q, 'sort'),
    { title: (s) => s.title, viewCount: (s) => s.viewCount, createdAt: (s) => s.createdAt },
    'createdAt:desc',
  );
  return paginate(list, q, 10);
}

export const adminSpace = (ctx: Ctx): Result => {
  const s = ctx.db.spaces.find((x) => x.id === Number(ctx.params.id));
  if (!s) throw notFound('Không gian mẫu');
  return ok(spaceDetail(ctx.db, s));
};

interface PanoInput {
  id?: number;
  url: string;
  title?: string | null;
  isStart?: boolean;
  hotspots?: Array<{
    type: 'product' | 'navigation' | 'info';
    yaw: number;
    pitch: number;
    productId?: number | null;
    targetIndex?: number | null;
    title?: string | null;
    content?: string | null;
  }>;
}

function saveSpace(ctx: Ctx, s: Db['spaces'][number], b: Body) {
  const db = ctx.db;
  const at = nowIso();
  s.title = String(b.title).trim();
  s.slug = slugify(b.slug || s.title) || s.slug;
  s.roomType = b.roomType;
  s.style = b.style || null;
  s.description = String(b.description ?? '');
  s.status = b.status ?? 'draft';
  s.publishedAt = s.status === 'published' ? (s.publishedAt ?? at) : null;
  s.updatedAt = at;
  if (b.coverUrl) s.coverMediaId = mediaFrom(db, b.coverUrl, `space-${s.slug}-cover.png`);
  if (Array.isArray(b.panoramas)) {
    const inputs = b.panoramas as PanoInput[];
    const oldIds = db.spacePanoramas.filter((p) => p.spaceId === s.id).map((p) => p.id);
    db.spaceHotspots = db.spaceHotspots.filter((h) => !oldIds.includes(h.panoramaId));
    db.spaceProductPlacements = db.spaceProductPlacements.filter((h) => !oldIds.includes(h.panoramaId));
    db.spacePanoramas = db.spacePanoramas.filter((p) => p.spaceId !== s.id);
    const newIds: number[] = [];
    inputs.forEach((pi, idx) => {
      const id = nextId(db.spacePanoramas);
      newIds.push(id);
      db.spacePanoramas.push({
        id,
        spaceId: s.id,
        mediaId: mediaFrom(db, pi.url, `space-${s.slug}-pano-${idx + 1}.png`),
        title: pi.title ?? null,
        defaultYaw: 0,
        defaultPitch: 0,
        defaultFov: 80,
        sortOrder: idx + 1,
        isStart: idx === 0,
        createdAt: at,
        updatedAt: at,
      });
    });
    inputs.forEach((pi, idx) => {
      (pi.hotspots ?? []).forEach((h) => {
        db.spaceHotspots.push({
          id: nextId(db.spaceHotspots),
          panoramaId: newIds[idx],
          type: h.type,
          yaw: Number(h.yaw),
          pitch: Number(h.pitch),
          productId: h.type === 'product' ? (h.productId ?? null) : null,
          targetPanoramaId:
            h.type === 'navigation' && h.targetIndex !== null && h.targetIndex !== undefined
              ? (newIds[h.targetIndex] ?? null)
              : null,
          title: h.title ?? null,
          content: h.content ?? null,
          createdAt: at,
          updatedAt: at,
        });
      });
    });
    // Sản phẩm gợi ý: bảo đảm mỗi sản phẩm có ít nhất một điểm tương tác trên ảnh đầu tiên
    if (Array.isArray(b.productIds) && newIds.length) {
      const have = new Set(
        db.spaceHotspots
          .filter((h) => newIds.includes(h.panoramaId) && h.type === 'product')
          .map((h) => h.productId),
      );
      (b.productIds as number[]).forEach((pid, i) => {
        if (!have.has(pid))
          db.spaceHotspots.push({
            id: nextId(db.spaceHotspots),
            panoramaId: newIds[0],
            type: 'product',
            yaw: -135 + i * 60,
            pitch: -8,
            productId: pid,
            targetPanoramaId: null,
            title: null,
            content: null,
            createdAt: at,
            updatedAt: at,
          });
      });
      db.spaceHotspots = db.spaceHotspots.filter(
        (h) =>
          !(
            newIds.includes(h.panoramaId) &&
            h.type === 'product' &&
            !(b.productIds as number[]).includes(h.productId!)
          ),
      );
    }
  }
}

function validateSpace(b: Body) {
  const errs: Record<string, string> = {};
  if (String(b.title ?? '').trim().length < 2) errs.title = 'Vui lòng nhập tên không gian.';
  if (!b.roomType) errs.roomType = 'Vui lòng chọn loại không gian.';
  if (String(b.description ?? '').trim().length < 10) errs.description = 'Mô tả tối thiểu 10 ký tự.';
  if (Object.keys(errs).length) throw validation(errs);
}

export function createSpace(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  validateSpace(b);
  const id = nextId(ctx.db.spaces);
  const at = nowIso();
  const s: Db['spaces'][number] = {
    id,
    uuid: `20000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    title: '',
    slug: `space-${id}`,
    description: null,
    roomType: 'living_room',
    style: null,
    categoryId: null,
    coverMediaId: null,
    status: 'draft',
    viewCount: 0,
    publishedAt: null,
    createdAt: at,
    updatedAt: at,
  };
  ctx.db.spaces.push(s);
  saveSpace(ctx, s, b);
  log(ctx, 'space.create', 'space', id);
  return created(spaceDetail(ctx.db, s));
}

export function updateSpace(ctx: Ctx): Result {
  const s = ctx.db.spaces.find((x) => x.id === Number(ctx.params.id));
  if (!s) throw notFound('Không gian mẫu');
  const b = { ...ctx.body };
  validateSpace({ title: s.title, roomType: s.roomType, description: s.description, ...b });
  saveSpace(ctx, s, {
    title: s.title,
    roomType: s.roomType,
    style: s.style,
    description: s.description,
    status: s.status,
    ...b,
  });
  return ok(spaceDetail(ctx.db, s));
}

export function deleteSpace(ctx: Ctx): Result {
  const db = ctx.db;
  const s = db.spaces.find((x) => x.id === Number(ctx.params.id));
  if (!s) throw notFound('Không gian mẫu');
  const pans = db.spacePanoramas.filter((p) => p.spaceId === s.id).map((p) => p.id);
  db.spaceHotspots = db.spaceHotspots.filter((h) => !pans.includes(h.panoramaId));
  db.spaceProductPlacements = db.spaceProductPlacements.filter((h) => !pans.includes(h.panoramaId));
  db.spacePanoramas = db.spacePanoramas.filter((p) => p.spaceId !== s.id);
  db.spaceBookmarks = db.spaceBookmarks.filter((b) => b.spaceId !== s.id);
  db.spaces.splice(db.spaces.indexOf(s), 1);
  return done();
}

// ===================== Nội dung =====================
export const adminBanners = (ctx: Ctx): Result =>
  ok([...ctx.db.banners].sort((a, b) => a.position.localeCompare(b.position) || a.sortOrder - b.sortOrder));

export function saveBanner(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  if (String(b.title ?? '').trim().length < 2) throw validation({ title: 'Vui lòng nhập tiêu đề banner.' });
  if (!b.imageUrl && !ctx.params.id) throw validation({ imageUrl: 'Vui lòng tải ảnh banner.' });
  const cur = ctx.params.id ? ctx.db.banners.find((x) => x.id === Number(ctx.params.id)) : null;
  if (ctx.params.id && !cur) throw notFound('Banner');
  const row = cur ?? {
    id: nextId(ctx.db.banners),
    title: '',
    subtitle: null,
    imageUrl: '',
    link: '/',
    position: 'hero-1' as const,
    startAt: nowIso(),
    endAt: null,
    sortOrder: ctx.db.banners.length + 1,
    isActive: true,
  };
  Object.assign(row, {
    title: String(b.title).trim(),
    subtitle: b.subtitle ?? row.subtitle,
    imageUrl: b.imageUrl || row.imageUrl,
    link: b.link || row.link,
    position: b.position || row.position,
    startAt: b.startAt || row.startAt,
    endAt: b.endAt === undefined ? row.endAt : b.endAt || null,
    sortOrder: b.sortOrder ?? row.sortOrder,
    isActive: b.isActive ?? row.isActive,
  });
  if (!cur) ctx.db.banners.push(row);
  return cur ? ok(row) : created(row);
}

export function deleteBanner(ctx: Ctx): Result {
  const i = ctx.db.banners.findIndex((x) => x.id === Number(ctx.params.id));
  if (i < 0) throw notFound('Banner');
  ctx.db.banners.splice(i, 1);
  return done();
}

export const adminPosts = (ctx: Ctx): Result =>
  ok([...ctx.db.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

export function savePost(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  if (String(b.title ?? '').trim().length < 5) throw validation({ title: 'Tiêu đề tối thiểu 5 ký tự.' });
  const cur = ctx.params.id ? ctx.db.posts.find((x) => x.id === Number(ctx.params.id)) : null;
  if (ctx.params.id && !cur) throw notFound('Bài viết');
  const row = cur ?? {
    id: nextId(ctx.db.posts),
    title: '',
    slug: '',
    category: 'Cảm hứng',
    coverUrl: '/mock-img/room?s=H%E1%BB%99i&r=living_room&n=1',
    content: '',
    authorName: 'Nguyễn Văn A',
    status: 'draft' as const,
    views: 0,
    publishedAt: null,
    createdAt: nowIso(),
  };
  Object.assign(row, {
    title: String(b.title).trim(),
    slug: slugify(b.title),
    category: b.category ?? row.category,
    content: b.content ?? row.content,
    coverUrl: b.coverUrl || row.coverUrl,
    status: b.status ?? row.status,
  });
  if (row.status === 'published' && !row.publishedAt) row.publishedAt = nowIso();
  if (!cur) ctx.db.posts.push(row);
  return cur ? ok(row) : created(row);
}

export function deletePost(ctx: Ctx): Result {
  const i = ctx.db.posts.findIndex((x) => x.id === Number(ctx.params.id));
  if (i < 0) throw notFound('Bài viết');
  ctx.db.posts.splice(i, 1);
  return done();
}

export const adminPages = (ctx: Ctx): Result => ok(ctx.db.pages);

const CORE_PAGE_SLUGS = [
  'about',
  've-chung-toi',
  'chinh-sach-mua-hang',
  'chinh-sach-doi-tra',
  'chinh-sach-bao-hanh',
  'chinh-sach-bao-mat',
  'dieu-khoan-su-dung',
  'chinh-sach-van-chuyen',
];

/** Mock của POST /admin/pages (giống BE: tiêu đề ≥ 2 ký tự, slug tự sinh, trùng ⇒ 409 kèm lỗi trường slug) */
export function createPage(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const title = String(b.title ?? '').trim();
  if (title.length < 2) throw validation({ title: 'Vui lòng nhập tiêu đề trang.' });
  const slug = slugify(String(b.slug || title));
  if (!slug) throw validation({ slug: 'Slug không hợp lệ.' });
  if (ctx.db.pages.some((x) => x.slug === slug))
    throw new ApiFail('CONFLICT', 'Dữ liệu bị trùng.', { slug: ['Slug đã tồn tại.'] });
  const status = b.status ? String(b.status) : 'draft';
  const row = {
    id: nextId(ctx.db.pages),
    title,
    slug,
    type: b.type === 'policy' ? 'policy' : 'static',
    content: String(b.content ?? ''),
    status,
    publishedAt: status === 'published' ? nowIso() : null,
    updatedAt: nowIso(),
  } as unknown as Db['pages'][number];
  ctx.db.pages.push(row);
  return created(row);
}

/** Mock của DELETE /admin/pages/:id: trang hệ thống ⇒ 409 */
export function deletePage(ctx: Ctx): Result {
  const i = ctx.db.pages.findIndex((x) => x.id === Number(ctx.params.id));
  if (i < 0) throw notFound('Trang');
  if (CORE_PAGE_SLUGS.includes(ctx.db.pages[i].slug))
    throw new ApiFail('RESOURCE_IN_USE', 'Không thể xóa trang hệ thống (Về chúng tôi, chính sách).');
  ctx.db.pages.splice(i, 1);
  return done();
}

export function savePage(ctx: Ctx): Result {
  const p = ctx.db.pages.find((x) => x.id === Number(ctx.params.id));
  if (!p) throw notFound('Trang');
  const b = ctx.body ?? {};
  if (b.title !== undefined) p.title = String(b.title);
  if (b.content !== undefined) p.content = String(b.content);
  if (b.status) p.status = b.status;
  p.updatedAt = nowIso();
  return ok(p);
}

// ===================== Cài đặt =====================
export const getSettings = (ctx: Ctx): Result => ok(settingsView(ctx.db));

export function saveSettings(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const put = (key: string, value: unknown) => {
    const row = ctx.db.settings.find((s) => s.key === key);
    if (row) {
      row.value = value as never;
      row.updatedAt = nowIso();
    }
  };
  if (b.store) {
    const errs: Record<string, string> = {};
    if (!String(b.store.name ?? '').trim()) errs.name = 'Vui lòng nhập tên cửa hàng.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.store.email ?? ''))) errs.email = 'Email không hợp lệ.';
    if (!String(b.store.hotline ?? '').trim()) errs.hotline = 'Vui lòng nhập hotline.';
    if (Object.keys(errs).length) throw validation(errs);
    put('store', b.store);
  }
  if (b.payments) put('payments', b.payments);
  if (b.shippingZones) put('shippingZones', b.shippingZones);
  return ok(settingsView(ctx.db));
}

export function resetMock(): Result {
  resetDb();
  return done();
}

// ===================== Thư viện media =====================
function mediaAdminView(db: Db, m: Db['media'][number]) {
  const required = db.productImages.filter((x) => x.mediaId === m.id).length;
  const optional =
    db.categories.filter((c) => c.imageMediaId === m.id).length +
    db.brands.filter((b) => b.logoMediaId === m.id).length +
    db.spaces.filter((s) => s.coverMediaId === m.id).length;
  return {
    id: m.id,
    fileName: m.fileName,
    url: m.filePath,
    mimeType: m.mimeType,
    fileSize: m.fileSize,
    altText: m.altText ?? null,
    uploadedByName: 'Nguyễn Văn A',
    createdAt: m.createdAt,
    usage: { required, optional },
  };
}
export function adminMedia(ctx: Ctx): Result {
  const q = fold(qStr(ctx.query, 'q'));
  let rows = [...ctx.db.media]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .filter((m) => !q || fold(`${m.fileName} ${m.altText ?? ''}`).includes(q))
    .map((m) => mediaAdminView(ctx.db, m));
  if (qStr(ctx.query, 'usage') === 'unused')
    rows = rows.filter((m) => m.usage.required + m.usage.optional === 0);
  return paginate(rows, ctx.query, 24);
}
export function createMedia(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(String(b.mimeType)))
    throw new ApiFail('UNSUPPORTED_MEDIA_TYPE', 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
  if (Number(b.fileSize) > 5 * 1024 * 1024) throw new ApiFail('PAYLOAD_TOO_LARGE', 'Ảnh vượt quá 5 MB.');
  const id = mediaFrom(
    ctx.db,
    String(b.fileData),
    String(b.fileName),
    String(b.mimeType),
    Number(b.fileSize),
  );
  const m = ctx.db.media.find((x) => x.id === id)!;
  m.altText = null;
  return created(mediaAdminView(ctx.db, m));
}
export function updateMedia(ctx: Ctx): Result {
  const m = ctx.db.media.find((x) => x.id === Number(ctx.params.id));
  if (!m) throw notFound('Tệp');
  const alt = String(ctx.body?.altText ?? '').trim();
  if (alt.length > 255) throw validation({ altText: 'Mô tả ảnh tối đa 255 ký tự.' });
  m.altText = alt || null;
  return ok(mediaAdminView(ctx.db, m));
}
export function deleteMedia(ctx: Ctx): Result {
  const m = ctx.db.media.find((x) => x.id === Number(ctx.params.id));
  if (!m) throw notFound('Tệp');
  if (mediaAdminView(ctx.db, m).usage.required > 0)
    throw new ApiFail('RESOURCE_IN_USE', 'Tệp đang được sử dụng nên không thể xóa.');
  ctx.db.media = ctx.db.media.filter((x) => x.id !== m.id);
  for (const c of ctx.db.categories) if (c.imageMediaId === m.id) c.imageMediaId = null;
  for (const b of ctx.db.brands) if (b.logoMediaId === m.id) b.logoMediaId = null;
  return ok({ id: m.id });
}

// ===================== Thuộc tính =====================
const SYSTEM_ATTR = ['color', 'size', 'material'];
function attrView(db: Db, a: Db['attributes'][number]) {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    isSystem: SYSTEM_ATTR.includes(a.code),
    values: db.attributeValues
      .filter((v) => v.attributeId === a.id)
      .map((v) => ({
        id: v.id,
        attributeId: v.attributeId,
        value: v.value,
        colorHex: a.code === 'color' ? (db.colorHexByValueId[v.id] ?? null) : null,
        usageCount: db.variantAttributeValues.filter((x) => x.attributeValueId === v.id).length,
        frameCount: 0,
      })),
  };
}
const conflict = (field: string, msg: string) => new ApiFail('CONFLICT', msg, { [field]: [msg] });
export const adminAttributes = (ctx: Ctx): Result => ok(ctx.db.attributes.map((a) => attrView(ctx.db, a)));
export function createAttribute(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const code = String(b.code ?? '').trim();
  const name = String(b.name ?? '').trim();
  const errs: Record<string, string> = {};
  if (!/^[a-z][a-z0-9_]*$/.test(code)) errs.code = 'Mã chỉ gồm chữ thường không dấu, số và gạch dưới.';
  if (!name) errs.name = 'Vui lòng nhập tên thuộc tính.';
  if (Object.keys(errs).length) throw validation(errs);
  if (ctx.db.attributes.some((a) => a.code === code)) throw conflict('code', 'Mã thuộc tính đã tồn tại.');
  if (ctx.db.attributes.some((a) => a.name === name)) throw conflict('name', 'Tên thuộc tính đã tồn tại.');
  const row = { id: nextId(ctx.db.attributes), code, name, createdAt: nowIso(), updatedAt: nowIso() };
  ctx.db.attributes.push(row);
  return created(attrView(ctx.db, row));
}
export function updateAttribute(ctx: Ctx): Result {
  const a = ctx.db.attributes.find((x) => x.id === Number(ctx.params.id));
  if (!a) throw notFound('Thuộc tính');
  const b = ctx.body ?? {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) throw validation({ name: 'Vui lòng nhập tên thuộc tính.' });
    if (ctx.db.attributes.some((x) => x.name === name && x.id !== a.id))
      throw conflict('name', 'Tên thuộc tính đã tồn tại.');
    a.name = name;
  }
  if (b.code !== undefined && b.code !== a.code) {
    if (SYSTEM_ATTR.includes(a.code))
      throw validation({ code: 'Mã của thuộc tính hệ thống không đổi được.' });
    if (ctx.db.attributes.some((x) => x.code === b.code)) throw conflict('code', 'Mã thuộc tính đã tồn tại.');
    a.code = String(b.code);
  }
  return ok(attrView(ctx.db, a));
}
export function deleteAttribute(ctx: Ctx): Result {
  const a = ctx.db.attributes.find((x) => x.id === Number(ctx.params.id));
  if (!a) throw notFound('Thuộc tính');
  if (SYSTEM_ATTR.includes(a.code))
    throw new ApiFail('RESOURCE_IN_USE', 'Không xóa được thuộc tính hệ thống.');
  ctx.db.attributeValues = ctx.db.attributeValues.filter((v) => v.attributeId !== a.id);
  ctx.db.attributes = ctx.db.attributes.filter((x) => x.id !== a.id);
  return ok({ id: a.id });
}
export function addAttributeValue(ctx: Ctx): Result {
  const a = ctx.db.attributes.find((x) => x.id === Number(ctx.params.id));
  if (!a) throw notFound('Thuộc tính');
  const value = String(ctx.body?.value ?? '').trim();
  if (!value) throw validation({ value: 'Vui lòng nhập giá trị.' });
  if (ctx.db.attributeValues.some((v) => v.attributeId === a.id && v.value === value))
    throw conflict('value', 'Giá trị này đã có trong thuộc tính.');
  const row = {
    id: nextId(ctx.db.attributeValues),
    attributeId: a.id,
    value,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  } as Db['attributeValues'][number];
  ctx.db.attributeValues.push(row);
  if (a.code === 'color' && ctx.body?.colorHex)
    ctx.db.colorHexByValueId[row.id] = String(ctx.body.colorHex).toUpperCase();
  return created(attrView(ctx.db, a).values.find((v) => v.id === row.id)!);
}
export function updateAttributeValue(ctx: Ctx): Result {
  const a = ctx.db.attributes.find((x) => x.id === Number(ctx.params.id));
  const v = ctx.db.attributeValues.find(
    (x) => x.id === Number(ctx.params.valueId) && x.attributeId === a?.id,
  );
  if (!a || !v) throw notFound('Giá trị thuộc tính');
  if (ctx.body?.value !== undefined) {
    const value = String(ctx.body.value).trim();
    if (!value) throw validation({ value: 'Vui lòng nhập giá trị.' });
    if (ctx.db.attributeValues.some((x) => x.attributeId === a.id && x.value === value && x.id !== v.id))
      throw conflict('value', 'Giá trị này đã có trong thuộc tính.');
    v.value = value;
  }
  if (a.code === 'color' && ctx.body?.colorHex)
    ctx.db.colorHexByValueId[v.id] = String(ctx.body.colorHex).toUpperCase();
  return ok(attrView(ctx.db, a).values.find((x) => x.id === v.id)!);
}
export function deleteAttributeValue(ctx: Ctx): Result {
  const a = ctx.db.attributes.find((x) => x.id === Number(ctx.params.id));
  const v = ctx.db.attributeValues.find(
    (x) => x.id === Number(ctx.params.valueId) && x.attributeId === a?.id,
  );
  if (!a || !v) throw notFound('Giá trị thuộc tính');
  const used = ctx.db.variantAttributeValues.filter((x) => x.attributeValueId === v.id).length;
  if (used)
    throw new ApiFail(
      'RESOURCE_IN_USE',
      `Giá trị "${v.value}" đang được ${used} biến thể sử dụng, không thể xóa.`,
    );
  ctx.db.attributeValues = ctx.db.attributeValues.filter((x) => x.id !== v.id);
  return ok({ id: v.id });
}

// ===================== Thương hiệu =====================
const brandAdminView = (db: Db, b: Db['brands'][number]) => ({
  id: b.id,
  name: b.name,
  slug: b.slug,
  logoUrl: mediaPath(db, b.logoMediaId),
  isActive: b.isActive,
  productCount: db.products.filter((p) => p.brandId === b.id && !p.deletedAt).length,
});
export function adminBrands(ctx: Ctx): Result {
  const q = fold(qStr(ctx.query, 'q'));
  return ok(
    ctx.db.brands
      .filter((b) => !q || fold(`${b.name} ${b.slug}`).includes(q))
      .map((b) => brandAdminView(ctx.db, b)),
  );
}
function brandInput(ctx: Ctx, self?: Db['brands'][number]) {
  const b = ctx.body ?? {};
  const name = String(b.name ?? self?.name ?? '').trim();
  if (!name) throw validation({ name: 'Vui lòng nhập tên thương hiệu.' });
  const slug = fold(String(b.slug || self?.slug || name))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (ctx.db.brands.some((x) => x.slug === slug && x.id !== self?.id))
    throw new ApiFail('CONFLICT', 'Slug đã được dùng cho thương hiệu khác.', {
      slug: ['Slug đã được dùng cho thương hiệu khác.'],
    });
  return { name, slug, b };
}
export function createBrand(ctx: Ctx): Result {
  const { name, slug, b } = brandInput(ctx);
  const row = {
    id: nextId(ctx.db.brands),
    name,
    slug,
    logoMediaId: b.logoUrl ? mediaFrom(ctx.db, b.logoUrl, `brand-${slug}.png`) : null,
    isActive: b.isActive !== false,
  } as Db['brands'][number];
  ctx.db.brands.push(row);
  return created(brandAdminView(ctx.db, row));
}
export function updateBrand(ctx: Ctx): Result {
  const row = ctx.db.brands.find((x) => x.id === Number(ctx.params.id));
  if (!row) throw notFound('Thương hiệu');
  const { name, slug, b } = brandInput(ctx, row);
  row.name = name;
  row.slug = slug;
  if (typeof b.isActive === 'boolean') row.isActive = b.isActive;
  if (b.logoUrl === null) row.logoMediaId = null;
  else if (b.logoUrl) row.logoMediaId = mediaFrom(ctx.db, b.logoUrl, `brand-${slug}.png`);
  return ok(brandAdminView(ctx.db, row));
}
export function deleteBrand(ctx: Ctx): Result {
  const i = ctx.db.brands.findIndex((x) => x.id === Number(ctx.params.id));
  if (i < 0) throw notFound('Thương hiệu');
  const id = ctx.db.brands[i].id;
  let n = 0;
  for (const p of ctx.db.products)
    if (p.brandId === id) {
      p.brandId = null;
      n++;
    }
  ctx.db.brands.splice(i, 1);
  return ok({ id, productsDetached: n });
}

// ===================== Kho hàng =====================
export function inventoryRows(db: Db): InventoryRow[] {
  return db.productVariants
    .filter((v) => v.isActive)
    .map((v) => {
      const p = db.products.find((x) => x.id === v.productId)!;
      const ex = db.productExtras.find((e) => e.productId === p.id);
      const cat = db.categories.find((c) => c.id === p.categoryId);
      const minStock = ex?.minStock ?? 5;
      const available = v.stockQuantity;
      return {
        variantId: v.id,
        productId: p.id,
        productName: `${p.name}${variantLabel(db, v.id) !== 'Tiêu chuẩn' ? ` – ${variantLabel(db, v.id)}` : ''}`,
        imageUrl: mediaPath(db, db.productImages.find((i) => i.productId === p.id && i.isPrimary)?.mediaId),
        sku: v.sku,
        categoryName: cat?.name ?? '—',
        costPrice: Math.round(effectivePrice(v) * (ex?.costRatio ?? 0.62)),
        stockQuantity: v.stockQuantity,
        available,
        minStock,
        state:
          available <= 0
            ? ('out' as const)
            : available <= minStock
              ? ('low' as const)
              : ('in_stock' as const),
      };
    });
}

/** Mock của POST /admin/inventory/movements (giống BE: số nguyên khác 0, giảm quá tồn ⇒ 409, không đổi gì) */
export function recordMovement(ctx: Ctx): Result {
  const b = ctx.body ?? {};
  const db = ctx.db;
  const errs: Record<string, string> = {};
  const v = db.productVariants.find((x) => x.id === Number(b.variantId));
  if (!v) errs.variantId = 'Vui lòng chọn biến thể.';
  const type = String(b.type ?? '');
  if (!['import', 'adjustment', 'return'].includes(type))
    errs.type = 'Loại biến động phải là import, adjustment hoặc return.';
  const qty = Number(b.quantityChange);
  if (!Number.isInteger(qty) || qty === 0)
    errs.quantityChange = 'Số lượng thay đổi phải là số nguyên khác 0.';
  else if (type !== 'adjustment' && qty < 0)
    errs.quantityChange = 'Nhập kho/hàng trả phải có số lượng dương.';
  const reason = String(b.reason ?? '').trim();
  if (reason.length > 255) errs.reason = 'Lý do tối đa 255 ký tự.';
  if (Object.keys(errs).length) throw validation(errs);
  if (v!.stockQuantity + qty < 0)
    throw new ApiFail('CONFLICT', `Không thể giảm quá số đang tồn (${v!.stockQuantity}).`);
  v!.stockQuantity += qty;
  db.inventoryMovements.push({
    id: nextId(db.inventoryMovements),
    variantId: v!.id,
    type: type as 'import' | 'adjustment' | 'return',
    quantityChange: qty,
    reason: reason || null,
    referenceCode: null,
    performedBy: ADMIN_ID,
    createdAt: nowIso(),
  } as never);
  return created({ variantId: v!.id, stockQuantity: v!.stockQuantity });
}

export function adminInventory(ctx: Ctx): Result {
  const q = ctx.query;
  const search = fold(qStr(q, 'q'));
  const state = qStr(q, 'state');
  const cat = qNum(q, 'categoryId', 0);
  let rows = inventoryRows(ctx.db);
  if (search) rows = rows.filter((r) => fold(`${r.productName} ${r.sku}`).includes(search));
  if (state) rows = rows.filter((r) => r.state === state);
  if (cat) {
    const ids = new Set([cat, ...ctx.db.categories.filter((c) => c.parentId === cat).map((c) => c.id)]);
    rows = rows.filter((r) => ids.has(ctx.db.products.find((p) => p.id === r.productId)?.categoryId ?? -1));
  }
  rows = sortBy(
    rows,
    qStr(q, 'sort'),
    {
      productName: (r) => r.productName,
      stockQuantity: (r) => r.stockQuantity,
      available: (r) => r.available,
      costPrice: (r) => r.costPrice,
    },
    'available:asc',
  );
  return paginate(rows, q, 10);
}

export function inventorySummary(ctx: Ctx): Result {
  const rows = inventoryRows(ctx.db);
  return ok({
    totalStock: rows.reduce((s, r) => s + r.stockQuantity, 0),
    stockValue: rows.reduce((s, r) => s + r.stockQuantity * r.costPrice, 0),
    lowCount: rows.filter((r) => r.state === 'low').length,
    outCount: rows.filter((r) => r.state === 'out').length,
  });
}

export const receipts = (ctx: Ctx): Result =>
  ok(
    [...ctx.db.stockReceipts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const { _items: _i, ...view } = r as typeof r & { _items?: unknown };
        return view;
      }),
  );

type ReceiptLine = { variantId: number; quantity: number; costPrice: number };
type MockReceipt = Db['stockReceipts'][number] & { _items?: ReceiptLine[] };

/** Áp phiếu vào tồn kho (xác nhận): movement mang mã phiếu; phiếu nhập sinh phiếu chi giá vốn; phiếu xuất thiếu hàng ⇒ 409 */
function applyReceipt(db: Db, row: MockReceipt, items: ReceiptLine[], at: string) {
  for (const it of items) {
    const v = db.productVariants.find((x) => x.id === it.variantId);
    if (!v) throw notFound('Biến thể');
    if (row.type === 'out' && v.stockQuantity < it.quantity)
      throw new ApiFail('OUT_OF_STOCK', `Không đủ tồn kho cho ${v.sku}.`, {
        variantId: v.id,
        available: v.stockQuantity,
      });
  }
  let total = 0;
  for (const it of items) {
    const v = db.productVariants.find((x) => x.id === it.variantId)!;
    v.stockQuantity += row.type === 'in' ? it.quantity : -it.quantity;
    total += it.quantity * it.costPrice;
    db.inventoryMovements.push({
      id: nextId(db.inventoryMovements),
      variantId: v.id,
      type: row.type === 'in' ? 'import' : 'adjustment',
      quantityChange: row.type === 'in' ? it.quantity : -it.quantity,
      reason: row.type === 'in' ? `Nhập kho theo phiếu ${row.code}` : `Xuất kho theo phiếu ${row.code}`,
      referenceCode: row.code,
      performedBy: ADMIN_ID,
      createdAt: at,
    });
  }
  row.status = 'completed';
  if (row.type === 'in') addExpense(db, 'cogs', total, `Giá vốn phiếu nhập ${row.code}`);
}

export function createReceipt(ctx: Ctx): Result {
  const db = ctx.db;
  const b = ctx.body ?? {};
  if (!['in', 'out'].includes(b.type)) throw validation({ type: 'Loại phiếu không hợp lệ.' });
  if (!Array.isArray(b.items) || !b.items.length)
    throw validation({ items: 'Vui lòng thêm ít nhất một sản phẩm.' });
  const supplierName = String(b.supplierName ?? '').trim();
  if (b.type === 'in' && !supplierName) throw validation({ supplierName: 'Vui lòng nhập nhà cung cấp.' });
  const items: ReceiptLine[] = [];
  for (const it of b.items as Array<{ variantId: number; quantity: number; costPrice: number }>) {
    if (!db.productVariants.find((x) => x.id === Number(it.variantId))) throw notFound('Biến thể');
    const qty = Math.floor(Number(it.quantity));
    if (!(qty >= 1)) throw validation({ items: 'Số lượng phải từ 1 trở lên.' });
    items.push({ variantId: Number(it.variantId), quantity: qty, costPrice: Number(it.costPrice) || 0 });
  }
  const at = nowIso();
  const id = nextId(db.stockReceipts);
  const row: MockReceipt = {
    id,
    code: `${b.type === 'in' ? 'PN' : 'PX'}${String(id).padStart(4, '0')}`,
    type: b.type as 'in' | 'out',
    supplierId: null,
    supplierName: b.type === 'in' ? supplierName : null,
    orderCode: null,
    itemCount: items.length,
    total: items.reduce((s, i) => s + i.quantity * i.costPrice, 0),
    status: 'draft',
    createdAt: at,
  };
  if (b.status === 'draft') row._items = items;
  else applyReceipt(db, row, items, at);
  db.stockReceipts.push(row);
  const { _items: _i, ...view } = row;
  return created(view);
}

function receiptAction(ctx: Ctx, kind: 'confirm' | 'cancel'): Result {
  const row = ctx.db.stockReceipts.find((r) => r.id === Number(ctx.params.id)) as MockReceipt | undefined;
  if (!row) throw notFound('Phiếu kho');
  if (row.status !== 'draft')
    throw new ApiFail(
      'INVALID_STATE',
      kind === 'confirm' ? 'Chỉ phiếu nháp mới xác nhận được.' : 'Chỉ phiếu nháp mới hủy được.',
    );
  if (kind === 'confirm') applyReceipt(ctx.db, row, row._items ?? [], nowIso());
  else row.status = 'cancelled';
  const { _items: _i, ...view } = row;
  return ok(view);
}
export const confirmReceipt = (ctx: Ctx): Result => receiptAction(ctx, 'confirm');
export const cancelReceipt = (ctx: Ctx): Result => receiptAction(ctx, 'cancel');

export function stockMovements(ctx: Ctx): Result {
  const db = ctx.db;
  const type = qStr(ctx.query, 'type');
  const variantId = qNum(ctx.query, 'variantId', 0);
  const list = db.inventoryMovements
    .filter((m) => (!type || m.type === type) && (!variantId || m.variantId === variantId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map((m) => {
      const v = db.productVariants.find((x) => x.id === m.variantId);
      const p = db.products.find((x) => x.id === v?.productId);
      return {
        id: m.id,
        variantId: m.variantId,
        sku: v?.sku ?? '—',
        productName: p?.name ?? '—',
        type: m.type,
        quantityChange: m.quantityChange,
        reason: m.reason ?? null,
        referenceCode: m.referenceCode ?? null,
        performedByName: 'Nguyễn Văn A',
        createdAt: m.createdAt,
      };
    });
  return paginate(list, ctx.query, 10);
}

// ===================== Thông báo & tìm kiếm của admin =====================
export function adminNotifications(ctx: Ctx): Result {
  const db = ctx.db;
  const out: Array<{ id: number; text: string; createdAt: string; link: string }> = [];
  db.orders
    .filter((o) => o.status === 'pending')
    .slice(-3)
    .forEach((o) =>
      out.push({
        id: o.id,
        text: `Đơn mới ${o.orderCode} đang chờ xác nhận`,
        createdAt: o.createdAt,
        link: `/admin/orders/${o.orderCode}`,
      }),
    );
  db.returnRequests
    .filter((r) => r.status === 'pending')
    .slice(-2)
    .forEach((r) =>
      out.push({
        id: 1000 + r.id,
        text: `Yêu cầu đổi trả ${r.code} chờ duyệt`,
        createdAt: r.createdAt,
        link: '/admin/returns',
      }),
    );
  db.productQuestions
    .filter((q) => q.status === 'unanswered')
    .slice(-2)
    .forEach((q) =>
      out.push({
        id: 2000 + q.id,
        text: `Câu hỏi mới về "${q.productName}"`,
        createdAt: q.createdAt,
        link: '/admin/questions',
      }),
    );
  db.reviews
    .filter((r) => r.status === 'pending')
    .slice(-2)
    .forEach((r) =>
      out.push({
        id: 3000 + r.id,
        text: 'Đánh giá mới chờ duyệt',
        createdAt: r.createdAt,
        link: '/admin/reviews',
      }),
    );
  return ok(out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function adminSearch(ctx: Ctx): Result {
  const q = fold(qStr(ctx.query, 'q'));
  if (!q) return ok([]);
  const db = ctx.db;
  const res: Array<{ type: 'product' | 'order' | 'customer'; label: string; href: string }> = [];
  db.products
    .filter((p) => !p.deletedAt && fold(p.name).includes(q))
    .slice(0, 4)
    .forEach((p) => res.push({ type: 'product', label: p.name, href: `/admin/products/${p.id}` }));
  db.orders
    .filter((o) => fold(o.orderCode).includes(q))
    .slice(0, 3)
    .forEach((o) => res.push({ type: 'order', label: o.orderCode, href: `/admin/orders/${o.orderCode}` }));
  db.users
    .filter((u) => u.id !== ADMIN_ID && fold(`${u.fullName} ${u.email}`).includes(q))
    .slice(0, 3)
    .forEach((u) =>
      res.push({ type: 'customer', label: `${u.fullName} – ${u.email}`, href: `/admin/customers/${u.id}` }),
    );
  return ok(res);
}

void sizeSets;
void colorOfVariant;
