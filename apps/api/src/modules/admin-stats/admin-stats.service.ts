// UC-ADM – Tổng quan (dashboard): KPI so với kỳ trước, doanh thu theo ngày, tỉ lệ trạng thái đơn, đơn gần đây,
// bán chạy, hoạt động gần đây. Mọi số liệu tính từ dữ liệu thật; ngày theo múi giờ Asia/Ho_Chi_Minh.
import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { qStr, type RawQuery } from '../../common/utils/list-query';
import { addDaysYmd, endOfDayVn, startOfDayVn, vnYmd } from '../../common/utils/vn-date';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORDER_INCLUDE, OrderViewsService } from '../orders/order-views.service';

const TZ = 'Asia/Ho_Chi_Minh';
const DAY = 86_400_000;
const STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'completed',
  'cancelled',
  'refunded',
];

const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function activityText(action: string, targetId: number | null, c: Record<string, unknown>): string {
  switch (action) {
    case 'order.create':
      return `đặt đơn hàng ${c.orderCode ?? `#${targetId}`}`;
    case 'review.create':
      return `đã đánh giá ${c.rating ?? ''} sao cho một sản phẩm`;
    case 'user.register':
      return 'đã đăng ký tài khoản mới';
    case 'order.update_status':
      return `cập nhật đơn hàng ${c.orderCode ?? ''}`;
    case 'product.update':
      return `cập nhật sản phẩm #${targetId}`;
    case 'product.create':
      return `thêm sản phẩm #${targetId}`;
    case 'coupon.create':
      return `tạo mã khuyến mãi ${c.code ?? ''}`;
    case 'review.approve':
      return 'duyệt một đánh giá';
    case 'model.upload':
      return `tải lên mô hình ${c.fileName ?? '3D'}`;
    default:
      return action;
  }
}

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly orderViews: OrderViewsService,
  ) {}

  /** Khoảng thời gian chọn + kỳ liền trước có cùng độ dài */
  range(q: RawQuery) {
    const today = vnYmd();
    const to = qStr(q, 'to') || today;
    const from = qStr(q, 'from') || addDaysYmd(to, -29); // 30 ngày tính cả ngày `to`
    const start = startOfDayVn(from);
    const end = endOfDayVn(to);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
    return {
      from,
      to,
      start,
      end,
      prevStart: new Date(start.getTime() - days * DAY),
      prevEnd: new Date(start.getTime() - 1),
    };
  }

  async overview(q: RawQuery) {
    const { start, end, prevStart, prevEnd } = this.range(q);
    const recognized: Prisma.OrderWhereInput = { status: { notIn: ['cancelled', 'refunded'] } };
    const inRange = (a: Date, b: Date): Prisma.OrderWhereInput => ({ createdAt: { gte: a, lte: b } });
    const sumTotal = async (a: Date, b: Date) =>
      Number(
        (
          await this.prisma.order.aggregate({
            _sum: { total: true },
            where: { ...recognized, ...inRange(a, b) },
          })
        )._sum.total ?? 0,
      );
    const newCust = (a: Date, b: Date) =>
      this.prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: { gte: a, lte: b },
          userRoles: { some: { role: { code: 'user' } } },
        },
      });

    const [ordersCur, ordersPrev, revCur, revPrev, custCur, custPrev, productsNow, productsPrev] =
      await Promise.all([
        this.prisma.order.count({ where: inRange(start, end) }),
        this.prisma.order.count({ where: inRange(prevStart, prevEnd) }),
        sumTotal(start, end),
        sumTotal(prevStart, prevEnd),
        newCust(start, end),
        newCust(prevStart, prevEnd),
        this.prisma.product.count({ where: { status: 'published', deletedAt: null } }),
        this.prisma.product.count({
          where: { status: 'published', deletedAt: null, createdAt: { lte: prevEnd } },
        }),
      ]);

    // doanh thu theo ngày (hoặc theo tháng nếu khoảng > 92 ngày)
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
    const byMonth = days > 92;
    const rows = await this.prisma.$queryRaw<
      Array<{ k: string; revenue: Prisma.Decimal | null; orders: bigint }>
    >`
      SELECT to_char(created_at AT TIME ZONE ${TZ}, ${byMonth ? 'YYYY-MM' : 'YYYY-MM-DD'}) AS k,
             COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS revenue,
             COUNT(*) AS orders
      FROM orders WHERE created_at BETWEEN ${start} AND ${end} GROUP BY 1`;
    const series = new Map<string, { revenue: number; orders: number }>();
    if (!byMonth) {
      for (let i = 0; i < days; i++)
        series.set(isoDay(new Date(start.getTime() + i * DAY + 7 * 3_600_000)), { revenue: 0, orders: 0 });
    }
    for (const r of rows) series.set(r.k, { revenue: Number(r.revenue ?? 0), orders: Number(r.orders) });

    const statusRows = await this.prisma.order.groupBy({
      by: ['status'],
      where: inRange(start, end),
      _count: true,
    });
    const count = new Map(statusRows.map((r) => [r.status, r._count]));
    const statusBreakdown = STATUSES.map((status) => ({
      status,
      count: count.get(status) ?? 0,
      percent: ordersCur ? Math.round(((count.get(status) ?? 0) / ordersCur) * 100) : 0,
    }));

    const recent = await this.prisma.order.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
      include: ORDER_INCLUDE,
    });
    const logs = await this.prisma.activityLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 6,
      include: { actor: { include: { avatarMedia: true } } },
    });

    return {
      totalOrders: ordersCur,
      revenue: revCur,
      newCustomers: custCur,
      totalProducts: productsNow,
      deltas: {
        orders: pct(ordersCur, ordersPrev),
        revenue: pct(revCur, revPrev),
        customers: pct(custCur, custPrev),
        products: pct(productsNow, productsPrev),
      },
      revenueSeries: [...series.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v })),
      statusBreakdown,
      recentOrders: await this.orderViews.toViews(recent, { customer: true }),
      topProducts: await this.topProducts(start, end),
      recentActivity: logs.map((a) => {
        const { actor, ...base } = a;
        return {
          ...base,
          actorName: actor?.fullName ?? 'Hệ thống',
          actorAvatarUrl: this.views.url(actor?.avatarMedia?.filePath),
          text: activityText(a.action, a.targetId, (a.changes ?? {}) as Record<string, unknown>),
        };
      }),
    };
  }

  /** Sản phẩm bán chạy trong khoảng (đơn không bị hủy/hoàn): theo số lượng rồi doanh thu */
  async topProducts(start: Date, end: Date, take = 5) {
    const rows = await this.prisma.$queryRaw<
      Array<{ product_id: number; sold: bigint; revenue: Prisma.Decimal }>
    >`SELECT v.product_id, SUM(i.quantity) AS sold, SUM(i.line_total) AS revenue
      FROM order_items i
      JOIN orders o ON o.id = i.order_id AND o.status NOT IN ('cancelled','refunded')
      JOIN product_variants v ON v.id = i.variant_id
      WHERE o.created_at BETWEEN ${start} AND ${end}
      GROUP BY v.product_id ORDER BY sold DESC, revenue DESC LIMIT ${take}`;
    if (!rows.length) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((r) => r.product_id) } },
      include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } },
    });
    return rows.map((r) => {
      const p = products.find((x) => x.id === r.product_id)!;
      return {
        productId: r.product_id,
        name: p.name,
        slug: p.slug,
        imageUrl: this.views.url(p.productImages[0]?.media.filePath),
        sold: Number(r.sold),
        revenue: Number(r.revenue),
      };
    });
  }
}
