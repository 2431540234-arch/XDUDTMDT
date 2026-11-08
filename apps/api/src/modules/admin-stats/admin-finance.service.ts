// Thu chi & báo cáo tài chính (trang /admin/reports) + phiếu chi thủ công. Quy ước (chuẩn/đặc tả không quy định ⇒ mặc định đã chốt):
//  • DOANH THU = tổng `orders.total` của đơn GIAO THÀNH CÔNG (đã sang `completed`), tính theo NGÀY GIAO (lần đầu sang completed
//    trong order_status_history), múi giờ Asia/Ho_Chi_Minh; đơn sau đó bị hoàn (`refunded`) vẫn là doanh thu ngày giao,
//    phần tiền đã hoàn nằm ở phiếu chi category `refund` (hệ thống tự sinh khi duyệt hoàn tiền) nên LỢI NHUẬN = thu − chi đã trừ hoàn.
//  • Phí vận chuyển, phí cổng thanh toán KHÔNG tự sinh phiếu chi: admin tự nhập (POST /admin/expenses).
//  • Phiếu nhập kho hoàn tất tự sinh phiếu chi `cogs` (giá vốn); hoàn tiền tự sinh phiếu chi `refund` (xem returns).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { nextExpenseCode } from '../../common/utils/code-generator';
import { qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { asBody, FieldErrors, str } from '../../common/utils/validate';
import { vnYmd } from '../../common/utils/vn-date';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminStatsService } from './admin-stats.service';

const DAY = 86_400_000;
const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

export const EXPENSE_LABEL: Record<string, string> = {
  cogs: 'Giá vốn hàng bán',
  shipping: 'Vận chuyển & lắp đặt',
  marketing: 'Marketing',
  payment_fee: 'Phí cổng thanh toán',
  refund: 'Hoàn tiền',
  other: 'Chi phí khác',
};
const METHOD_LABEL: Record<string, string> = {
  cod: 'COD',
  vnpay: 'VNPAY',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
};
/** Loại phiếu chi admin được nhập tay (hoàn tiền chỉ do hệ thống sinh khi duyệt đổi trả) */
const MANUAL_CATEGORIES = ['cogs', 'shipping', 'marketing', 'payment_fee', 'other'];

interface DoneOrder {
  id: number;
  order_code: string;
  subtotal: Prisma.Decimal;
  shipping_fee: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  total: Prisma.Decimal;
  payment_method: string;
  status: string;
  done_at: Date;
}

@Injectable()
export class AdminFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly stats: AdminStatsService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Đơn giao thành công có ngày giao trong [a, b] */
  private doneOrders(a: Date, b: Date) {
    return this.prisma.$queryRaw<DoneOrder[]>`
      SELECT o.id, o.order_code, o.subtotal, o.shipping_fee, o.discount_amount, o.total, o.payment_method::text AS payment_method,
             o.status::text AS status, d.done_at
      FROM orders o
      JOIN LATERAL (SELECT MIN(h.created_at) AS done_at FROM order_status_history h
                    WHERE h.order_id = o.id AND h.to_status = 'completed') d ON d.done_at IS NOT NULL
      WHERE o.status IN ('completed', 'refunded') AND d.done_at BETWEEN ${a} AND ${b}`;
  }

  private expensesIn(from: string, to: string) {
    return this.prisma.expense.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }

  async report(q: RawQuery) {
    const r = this.stats.range(q);
    const days = Math.max(1, Math.ceil((r.end.getTime() - r.start.getTime()) / DAY));
    const prevFrom = vnYmd(r.prevStart);
    const prevTo = vnYmd(r.prevEnd);

    const [cur, prev, expCur, expPrev] = await Promise.all([
      this.doneOrders(r.start, r.end),
      this.doneOrders(r.prevStart, r.prevEnd),
      this.expensesIn(r.from, r.to),
      this.expensesIn(prevFrom, prevTo),
    ]);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    const income = (os: DoneOrder[]) => sum(os.map((o) => Number(o.total)));
    const spend = (es: Array<{ amount: Prisma.Decimal }>) => sum(es.map((e) => Number(e.amount)));
    const totalIncome = income(cur);
    const totalExpense = spend(expCur);
    const profit = totalIncome - totalExpense;
    const prevIncome = income(prev);
    const prevExpense = spend(expPrev);
    const margin = totalIncome ? Math.round((profit / totalIncome) * 1000) / 10 : 0;
    const prevMargin = prevIncome ? ((prevIncome - prevExpense) / prevIncome) * 100 : 0;

    // doanh thu → lợi nhuận trước thuế
    const gross = sum(cur.map((o) => Number(o.subtotal) + Number(o.shipping_fee)));
    const discount = sum(cur.map((o) => Number(o.discount_amount)));
    const catSum = (c: string) => spend(expCur.filter((e) => e.category === c));
    const refunds = catSum('refund');
    const cogs = catSum('cogs');
    const opex = spend(expCur.filter((e) => e.category !== 'cogs' && e.category !== 'refund'));
    const net = gross - discount - refunds;

    // theo tháng của năm chứa ngày kết thúc
    const year = Number(r.to.slice(0, 4));
    const yStart = new Date(`${year}-01-01T00:00:00+07:00`);
    const yEnd = new Date(`${year}-12-31T23:59:59.999+07:00`);
    const [yOrders, yExp] = await Promise.all([
      this.doneOrders(yStart, yEnd),
      this.expensesIn(`${year}-01-01`, `${year}-12-31`),
    ]);
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const inc = sum(
        yOrders.filter((o) => Number(vnYmd(o.done_at).slice(5, 7)) === m + 1).map((o) => Number(o.total)),
      );
      const exp = sum(yExp.filter((e) => e.date.getUTCMonth() === m).map((e) => Number(e.amount)));
      return { month: `T${m + 1}`, income: inc, expense: exp, profit: inc - exp };
    });

    const expenseBreakdown = Object.keys(EXPENSE_LABEL).map((category) => {
      const amount = catSum(category);
      return {
        category,
        label: EXPENSE_LABEL[category],
        amount,
        percent: totalExpense ? Math.round((amount / totalExpense) * 100) : 0,
      };
    });

    const methods = new Map<string, number>();
    for (const o of cur)
      methods.set(o.payment_method, (methods.get(o.payment_method) ?? 0) + Number(o.total));
    const byPaymentMethod = [...methods.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m, amount]) => ({
        method: METHOD_LABEL[m] ?? m,
        amount,
        percent: totalIncome ? Math.round((amount / totalIncome) * 100) : 0,
      }));

    // doanh thu theo danh mục (đơn giao thành công chưa bị hoàn)
    const keepIds = cur.filter((o) => o.status === 'completed').map((o) => o.id);
    const catRows = keepIds.length
      ? await this.prisma.$queryRaw<Array<{ name: string | null; amount: Prisma.Decimal }>>`
          SELECT c.name, SUM(i.line_total) AS amount
          FROM order_items i
          LEFT JOIN product_variants v ON v.id = i.variant_id
          LEFT JOIN products p ON p.id = v.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE i.order_id IN (${Prisma.join(keepIds)})
          GROUP BY c.name ORDER BY amount DESC`
      : [];
    const catTotal = sum(catRows.map((c) => Number(c.amount))) || 1;
    const top5 = catRows.slice(0, 5).map((c) => ({ name: c.name ?? 'Khác', amount: Number(c.amount) }));
    const rest = sum(catRows.slice(5).map((c) => Number(c.amount)));
    const byCategory = [...top5, ...(rest ? [{ name: 'Khác', amount: rest }] : [])].map((c) => ({
      ...c,
      percent: Math.round((c.amount / catTotal) * 100),
    }));

    // doanh thu theo ngày (tối đa 31 ngày cuối của khoảng)
    const dayCount = Math.min(31, days);
    const daily = Array.from({ length: dayCount }, (_, i) => {
      const date = vnYmd(new Date(r.end.getTime() - (dayCount - 1 - i) * DAY));
      return {
        date,
        revenue: sum(cur.filter((o) => vnYmd(o.done_at) === date).map((o) => Number(o.total))),
      };
    });

    const ledger = [
      ...cur.map((o) => ({
        date: o.done_at.toISOString(),
        code: `TH-${o.order_code}`,
        content: `Thu tiền đơn ${o.order_code} (${METHOD_LABEL[o.payment_method] ?? o.payment_method})`,
        type: 'income' as const,
        category: 'Doanh thu bán hàng',
        amount: Number(o.total),
      })),
      ...expCur.map((e) => ({
        date: new Date(`${e.date.toISOString().slice(0, 10)}T00:00:00+07:00`).toISOString(),
        code: e.code,
        content: e.note,
        type: 'expense' as const,
        category: EXPENSE_LABEL[e.category],
        amount: -Number(e.amount),
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 150);

    return {
      totalIncome,
      totalExpense,
      profit,
      margin,
      deltas: {
        income: pct(totalIncome, prevIncome),
        expense: pct(totalExpense, prevExpense),
        profit: pct(profit, prevIncome - prevExpense),
        margin: Math.round(margin - prevMargin),
      },
      monthly,
      expenseBreakdown,
      byPaymentMethod,
      byCategory,
      daily,
      income: {
        gross,
        discountAndRefund: discount + refunds,
        net,
        cogs,
        grossProfit: net - cogs,
        opex,
        profitBeforeTax: net - cogs - opex,
      },
      ledger,
      topProducts: await this.topProducts(cur.map((o) => o.id)),
    };
  }

  /** Bán chạy trong các đơn giao thành công của kỳ: theo số lượng rồi doanh thu */
  private async topProducts(orderIds: number[], take = 5) {
    if (!orderIds.length) return [];
    const rows = await this.prisma.$queryRaw<
      Array<{ product_id: number; sold: bigint; revenue: Prisma.Decimal }>
    >`
      SELECT v.product_id, SUM(i.quantity) AS sold, SUM(i.line_total) AS revenue
      FROM order_items i JOIN product_variants v ON v.id = i.variant_id
      WHERE i.order_id IN (${Prisma.join(orderIds)})
      GROUP BY v.product_id ORDER BY sold DESC, revenue DESC LIMIT ${take}`;
    if (!rows.length) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((x) => x.product_id) } },
      include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } },
    });
    return rows.map((x) => {
      const p = products.find((y) => y.id === x.product_id)!;
      return {
        productId: x.product_id,
        name: p.name,
        slug: p.slug,
        imageUrl: this.views.url(p.productImages[0]?.media.filePath),
        sold: Number(x.sold),
        revenue: Number(x.revenue),
      };
    });
  }

  // ---------------------------------------------------------------- phiếu chi
  private view(e: {
    id: number;
    code: string;
    category: string;
    amount: Prisma.Decimal;
    note: string;
    date: Date;
  }) {
    return {
      id: e.id,
      code: e.code,
      category: e.category,
      amount: Number(e.amount),
      note: e.note,
      date: new Date(`${e.date.toISOString().slice(0, 10)}T00:00:00+07:00`).toISOString(),
    };
  }

  async listExpenses(q: RawQuery) {
    const where: Prisma.ExpenseWhereInput = {};
    const cat = qStr(q, 'category');
    if (Object.keys(EXPENSE_LABEL).includes(cat)) where.category = cat as never;
    const from = qStr(q, 'from');
    const to = qStr(q, 'to');
    if (from || to)
      where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const total = await this.prisma.expense.count({ where });
    const page = resolvePage(q, total, qNum(q, 'pageSize', 20));
    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: rows.map((e) => this.view(e)), page: page.page, pageSize: page.pageSize, total };
  }

  /** { category, amount > 0, note, date (YYYY-MM-DD hoặc ISO) } – không nhận category `refund` (do hệ thống sinh) */
  async createExpense(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const category = str(b.category);
    if (!MANUAL_CATEGORIES.includes(category))
      errs.add('category', 'Danh mục không hợp lệ (hoàn tiền do hệ thống tự ghi khi duyệt đổi trả).');
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) errs.add('amount', 'Số tiền phải lớn hơn 0.');
    else if (amount > 999_999_999_999) errs.add('amount', 'Số tiền quá lớn.');
    const note = str(b.note).trim();
    if (!note) errs.add('note', 'Vui lòng nhập nội dung.');
    else if (note.length > 500) errs.add('note', 'Nội dung tối đa 500 ký tự.');
    const ymd = str(b.date).slice(0, 10);
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(ymd) && !Number.isNaN(Date.parse(ymd));
    if (!okDate) errs.add('date', 'Ngày không hợp lệ.');
    errs.throwIfAny();
    const row = await this.prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: {
          code: await nextExpenseCode(tx),
          category: category as never,
          amount: Math.round(amount),
          note,
          date: new Date(ymd),
        },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'expense.create',
          targetType: 'expense',
          targetId: e.id,
          changes: { code: e.code, category, amount: Math.round(amount) },
        },
        tx,
      );
      return e;
    });
    return this.view(row);
  }

  async removeExpense(adminId: number, id: number) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Phiếu chi không tồn tại.');
    if (e.orderId || e.receiptId)
      throw new AppException(
        ErrorCode.INVALID_STATE,
        'Phiếu chi do hệ thống tự sinh (gắn với đơn/phiếu kho), không xóa được.',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'expense.delete',
          targetType: 'expense',
          targetId: id,
          changes: { code: e.code },
        },
        tx,
      );
    });
    return null;
  }
}
