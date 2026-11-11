// Dựng OrderView theo contract (docs/API_CONTRACT.md): đơn + dòng hàng + lịch sử + thanh toán + vận đơn + khách (admin).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { serialize } from '../../common/utils/serialize';
import { CatalogViews, PRODUCT_INCLUDE } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

export const RETURN_WINDOW_DAYS = 7;

export const ORDER_INCLUDE = {
  orderItems: {
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
  orderStatusHistory: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      changedByUser: { select: { id: true, fullName: true, userRoles: { include: { role: true } } } },
    },
  },
  payments: { orderBy: { id: 'asc' } },
  shipments: { orderBy: { id: 'asc' } },
  coupon: true,
} satisfies Prisma.OrderInclude;

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrderViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly users: UsersService,
  ) {}

  /** Một lượt truy vấn: các (đơn, sản phẩm) đã được đánh giá */
  private async reviewedSet(orderIds: number[]) {
    if (!orderIds.length) return new Set<string>();
    const rows = await this.prisma.review.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true, productId: true },
    });
    return new Set(rows.map((r) => `${r.orderId}:${r.productId}`));
  }

  /** opts.customer: kèm thông tin khách (dùng cho admin) */
  async toViews(rows: OrderRow[], opts: { customer?: boolean } = {}) {
    const reviewed = await this.reviewedSet(rows.map((o) => o.id));
    const customers = new Map<number, Awaited<ReturnType<UsersService['view']>>>();
    if (opts.customer && rows.length) {
      const ids = [...new Set(rows.map((o) => o.userId))];
      const [users, stats] = await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: ids } },
          include: { userRoles: { include: { role: true } }, avatarMedia: true },
        }),
        this.users.stats(ids),
      ]);
      for (const u of users) customers.set(u.id, this.users.toView(u, stats.get(u.id)));
    }
    return rows.map((o) => this.build(o, reviewed, customers.get(o.userId) ?? null));
  }

  async toView(row: OrderRow, opts: { customer?: boolean } = {}) {
    return (await this.toViews([row], opts))[0];
  }

  private build(
    o: OrderRow,
    reviewed: Set<string>,
    customer: Awaited<ReturnType<UsersService['view']>> | null,
  ) {
    const items = o.orderItems.map((it) => {
      const v = it.variant;
      const p = v?.product ?? null;
      const imageUrl =
        v && p ? (this.views.variantViews(p).find((x) => x.id === v.id)?.imageUrl ?? null) : null;
      const { variant: _v, ...base } = it;
      void _v;
      return {
        ...serialize(base),
        imageUrl,
        productSlug: p?.slug ?? null,
        productId: p?.id ?? null,
        variantLabel: it.variantLabel ?? (v ? this.views.variantLabel(v) : '—'),
        reviewed: Boolean(p && reviewed.has(`${o.id}:${p.id}`)),
      };
    });
    const shipment = o.shipments[o.shipments.length - 1] ?? null; // vận đơn hiện tại = mới nhất
    const delivered = shipment?.deliveredAt ?? null;
    const { orderItems: _oi, orderStatusHistory, payments, shipments: _s, coupon, ...base } = o;
    void _oi;
    void _s;
    return {
      ...serialize(base),
      items,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      history: orderStatusHistory.map((h) => {
        const { changedByUser, ...hb } = h;
        const isAdmin = changedByUser?.userRoles.some((r) => r.role.code === 'admin');
        return {
          ...hb,
          actorName:
            h.changedBy === null ? 'Hệ thống' : isAdmin ? 'Admin' : (changedByUser?.fullName ?? 'Khách hàng'),
        };
      }),
      payment: payments[0] ? serialize(payments[0]) : null,
      shipment: shipment ? serialize(shipment) : null,
      shipments: o.shipments.map((x) => serialize(x)),
      couponCode: coupon?.code ?? null,
      customer: customer
        ? {
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            phone: customer.phone,
            avatarUrl: customer.avatarUrl,
            totalOrders: customer.totalOrders,
            customerGroup: customer.customerGroup,
          }
        : null,
      internalNote: o.internalNote ?? null,
      deliveredAt: delivered,
      canReturnUntil:
        o.status === 'completed' && delivered
          ? new Date(delivered.getTime() + RETURN_WINDOW_DAYS * 86_400_000).toISOString()
          : null,
    };
  }
}
