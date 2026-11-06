// Chuông thông báo và ô tìm kiếm nhanh của khu vực admin: GET /admin/notifications, GET /admin/search
import { Injectable } from '@nestjs/common';
import { qStr, type RawQuery } from '../../common/utils/list-query';
import { foldVi } from '../../common/utils/vi-fold';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminMiscService {
  constructor(private readonly prisma: PrismaService) {}

  /** Việc cần xử lý: đơn chờ xác nhận, đổi trả chờ duyệt, câu hỏi chưa trả lời, đánh giá chờ duyệt */
  async notifications() {
    const [orders, returns, questions, reviews] = await Promise.all([
      this.prisma.order.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 3 }),
      this.prisma.returnRequest.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 2,
      }),
      this.prisma.productQuestion.findMany({
        where: { status: 'unanswered' },
        orderBy: { createdAt: 'desc' },
        take: 2,
        include: { product: { select: { name: true } } },
      }),
      this.prisma.review.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 2 }),
    ]);
    const out: Array<{ id: number; text: string; createdAt: string; link: string }> = [
      ...orders.map((o) => ({
        id: o.id,
        text: `Đơn mới ${o.orderCode} đang chờ xác nhận`,
        createdAt: o.createdAt.toISOString(),
        link: `/admin/orders/${o.orderCode}`,
      })),
      ...returns.map((r) => ({
        id: 1000 + r.id,
        text: `Yêu cầu đổi trả ${r.code} chờ duyệt`,
        createdAt: r.createdAt.toISOString(),
        link: '/admin/returns',
      })),
      ...questions.map((x) => ({
        id: 2000 + x.id,
        text: `Câu hỏi mới về "${x.product.name}"`,
        createdAt: x.createdAt.toISOString(),
        link: '/admin/questions',
      })),
      ...reviews.map((r) => ({
        id: 3000 + r.id,
        text: 'Đánh giá mới chờ duyệt',
        createdAt: r.createdAt.toISOString(),
        link: '/admin/reviews',
      })),
    ];
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async search(q: RawQuery) {
    const term = foldVi(qStr(q, 'q'));
    if (!term) return [];
    const like = `%${term}%`;
    const [products, orders, customers] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ id: number; name: string }>
      >`SELECT id, name FROM products WHERE deleted_at IS NULL AND immutable_unaccent(lower(name)) LIKE ${like} ORDER BY id LIMIT 4`,
      this.prisma.$queryRaw<
        Array<{ order_code: string }>
      >`SELECT order_code FROM orders WHERE lower(order_code) LIKE ${like} ORDER BY created_at DESC LIMIT 3`,
      this.prisma.$queryRaw<Array<{ id: number; full_name: string; email: string }>>`
        SELECT u.id, u.full_name, u.email FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id AND r.code = 'user'
        WHERE u.deleted_at IS NULL AND immutable_unaccent(lower(u.full_name || ' ' || u.email)) LIKE ${like} ORDER BY u.id LIMIT 3`,
    ]);
    return [
      ...products.map((p) => ({ type: 'product' as const, label: p.name, href: `/admin/products/${p.id}` })),
      ...orders.map((o) => ({
        type: 'order' as const,
        label: o.order_code,
        href: `/admin/orders/${o.order_code}`,
      })),
      ...customers.map((u) => ({
        type: 'customer' as const,
        label: `${u.full_name} – ${u.email}`,
        href: `/admin/customers/${u.id}`,
      })),
    ];
  }
}
