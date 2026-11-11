// M14 – Thông báo của khách: danh sách (lọc theo loại), số chưa đọc, đánh dấu đã đọc. Bảng: notifications
// Thông báo do Service nghiệp vụ tạo (common/utils/notify.ts), data = { type, content, link }.
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { PrismaService } from '../../prisma/prisma.service';

type NotificationRow = Prisma.NotificationGetPayload<object>;

export function notificationView(n: NotificationRow) {
  const d = (n.data ?? {}) as { type?: string; content?: string; link?: string | null };
  return {
    ...n,
    data: {
      type: (d.type as 'order' | 'promo' | 'system') ?? 'system',
      content: d.content ?? '',
      link: d.link ?? null,
    },
  };
}

export type NotificationType = 'order' | 'promo' | 'system';

/**
 * Dịch vụ thông báo DÙNG CHUNG cho mọi module (D-N19: Service tạo thông báo, không dùng trigger).
 * data = { type, content, link } theo contract. Truyền `tx` để ghi cùng transaction với thao tác chính.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  notify(
    db: PrismaClient | Prisma.TransactionClient,
    userId: number,
    title: string,
    type: NotificationType,
    content: string,
    link: string | null,
  ) {
    return db.notification.create({ data: { userId, title, data: { type, content, link } } });
  }

  async list(userId: number, q: RawQuery) {
    const type = qStr(q, 'type');
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(type ? { data: { path: ['type'], equals: type } } : {}),
    };
    const total = await this.prisma.notification.count({ where });
    const page = resolvePage(q, total, 10);
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: rows.map(notificationView), page: page.page, pageSize: page.pageSize, total };
  }

  async unreadCount(userId: number) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: number, id: number) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Thông báo không tồn tại.');
    const updated = n.readAt
      ? n
      : await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return notificationView(updated);
  }

  async markAllRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return null;
  }
}
