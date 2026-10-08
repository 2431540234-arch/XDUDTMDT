import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityLogInput {
  actorId?: number | null;
  /** Dạng "<đối tượng>.<hành động>", ví dụ "product.create", "order.cancel" */
  action: string;
  targetType?: string;
  targetId?: number;
  /** Ví dụ { before: {...}, after: {...} } */
  changes?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/** Ghi nhật ký thao tác quản trị vào activity_logs (không dùng trigger, xem QUY_UOC_CODE_DB.md). */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Truyền `tx` để ghi trong cùng transaction với thao tác chính. */
  log(input: ActivityLogInput, tx: Prisma.TransactionClient = this.prisma) {
    return tx.activityLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        changes: input.changes,
        ipAddress: input.ipAddress,
      },
    });
  }
}
