// Báo cáo doanh thu (trang /admin/reports). Quy ước (chuẩn/đặc tả không quy định ⇒ mặc định đã chốt):
//  • DOANH THU = tổng `orders.total` của đơn GIAO THÀNH CÔNG (đã sang `completed`), tính theo NGÀY GIAO (lần đầu sang completed
//    trong order_status_history), múi giờ Asia/Ho_Chi_Minh; đơn đã hoàn tiền (`refunded`) không tính vào doanh thu.
//  • Không có sổ chi phí: báo cáo chỉ gồm doanh thu, không tính chi phí/lợi nhuận.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RawQuery } from '../../common/utils/list-query';
import { vnYmd } from '../../common/utils/vn-date';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminStatsService } from './admin-stats.service';

const DAY = 86_400_000;
const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

const METHOD_LABEL: Record<string, string> = {
  cod: 'COD',
  vnpay: 'VNPAY',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
};

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
  ) {}

  /** Đơn giao thành công (chưa hoàn tiền) có ngày giao trong [a, b] */
  private doneOrders(a: Date, b: Date) {
    return this.prisma.$queryRaw<DoneOrder[]>`
      SELECT o.id, o.order_code, o.subtotal, o.shipping_fee, o.discount_amount, o.total, o.payment_method::text AS payment_method,
             o.status::text AS status, d.done_at
      FROM orders o
      JOIN LATERAL (SELECT MIN(h.created_at) AS done_at FROM order_status_history h
                    WHERE h.order_id = o.id AND h.to_status = 'completed') d ON d.done_at IS NOT NULL
      WHERE o.status = 'completed' AND d.done_at BETWEEN ${a} AND ${b}`;
  }

  async report(q: RawQuery) {
    const r = this.stats.range(q);
    const days = Math.max(1, Math.ceil((r.end.getTime() - r.start.getTime()) / DAY));

    const [cur, prev] = await Promise.all([
      this.doneOrders(r.start, r.end),
      this.doneOrders(r.prevStart, r.prevEnd),
    ]);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    const income = (os: DoneOrder[]) => sum(os.map((o) => Number(o.total)));
    const totalIncome = income(cur);
    const prevIncome = income(prev);

    // doanh thu gộp → doanh thu thuần
    const gross = sum(cur.map((o) => Number(o.subtotal) + Number(o.shipping_fee)));
    const discount = sum(cur.map((o) => Number(o.discount_amount)));
    const net = gross - discount;

    // theo tháng của năm chứa ngày kết thúc
    const year = Number(r.to.slice(0, 4));
    const yStart = new Date(`${year}-01-01T00:00:00+07:00`);
    const yEnd = new Date(`${year}-12-31T23:59:59.999+07:00`);
    const yOrders = await this.doneOrders(yStart, yEnd);
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const inc = sum(
        yOrders.filter((o) => Number(vnYmd(o.done_at).slice(5, 7)) === m + 1).map((o) => Number(o.total)),
      );
      return { month: `T${m + 1}`, income: inc };
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

    // doanh thu theo danh mục
    const keepIds = cur.map((o) => o.id);
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

    const ledger = cur
      .map((o) => ({
        date: o.done_at.toISOString(),
        code: `TH-${o.order_code}`,
        content: `Thu tiền đơn ${o.order_code} (${METHOD_LABEL[o.payment_method] ?? o.payment_method})`,
        type: 'income' as const,
        category: 'Doanh thu bán hàng',
        amount: Number(o.total),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 150);

    return {
      totalIncome,
      deltas: { income: pct(totalIncome, prevIncome) },
      monthly,
      byPaymentMethod,
      byCategory,
      daily,
      income: { gross, discount, net },
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
}
