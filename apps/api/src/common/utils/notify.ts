// Tạo thông báo cho khách (D-N19: do Service tạo, không dùng trigger). data = { type, content, link } theo contract.
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type NotificationType = 'order' | 'promo' | 'system';

export function notify(
  db: Db,
  userId: number,
  title: string,
  type: NotificationType,
  content: string,
  link: string | null,
) {
  return db.notification.create({ data: { userId, title, data: { type, content, link } } });
}
