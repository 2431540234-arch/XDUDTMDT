// UC-ADM-27 – Xem nhật ký hoạt động của quản trị viên (chỉ đọc). Bảng: activity_logs, users (R).
// Dòng do ActivityLogInterceptor ghi (lưới an toàn) có changes.auto = true, hiển thị khác dòng do service ghi.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { PrismaService } from '../../prisma/prisma.service';
import { parseVnDate } from '../../common/utils/vn-date';

/** Ngày yyyy-MM-dd (hoặc ISO) ⇒ Date; `end` = hết ngày. Sai định dạng ⇒ 400 */
function parseDate(field: 'from' | 'to', raw: string): Date {
  const d = parseVnDate(raw, field === 'to' ? 'end' : 'start'); // chỉ có ngày ⇒ ngày giờ Việt Nam
  if (Number.isNaN(d.getTime()))
    throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
      [field]: ['Ngày không hợp lệ (định dạng yyyy-MM-dd).'],
    });
  return d;
}

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /admin/activity-logs?actorId=&action=&targetType=&from=&to=&page=&pageSize= (mới nhất trước; dùng idx_activity_logs_target) */
  async list(q: RawQuery) {
    const where: Prisma.ActivityLogWhereInput = {};
    const actorRaw = qStr(q, 'actorId');
    if (actorRaw) {
      const actorId = Number(actorRaw);
      if (!Number.isInteger(actorId) || actorId < 1)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          actorId: ['Mã quản trị viên không hợp lệ.'],
        });
      where.actorId = actorId;
    }
    const action = qStr(q, 'action').trim();
    if (action) where.action = { contains: action, mode: 'insensitive' };
    const targetType = qStr(q, 'targetType').trim();
    if (targetType) where.targetType = targetType;
    const from = qStr(q, 'from');
    const to = qStr(q, 'to');
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = parseDate('from', from);
    if (to) range.lte = parseDate('to', to);
    if (range.gte && range.lte && range.gte > range.lte)
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
        to: ['Ngày kết thúc phải sau ngày bắt đầu.'],
      });
    if (range.gte || range.lte) where.createdAt = range;

    const total = await this.prisma.activityLog.count({ where });
    const page = resolvePage(q, total, qNum(q, 'pageSize', 20));
    const rows = await this.prisma.activityLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorName: r.actor?.fullName ?? null,
        actorEmail: r.actor?.email ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        changes: r.changes,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
        /** true ⇒ do ActivityLogInterceptor ghi (service không ghi log cho thao tác này) */
        auto: (r.changes as { auto?: boolean } | null)?.auto === true,
      })),
      page: page.page,
      pageSize: page.pageSize,
      total,
    };
  }

  /** Giá trị cho bộ lọc: quản trị viên đã có thao tác, các hành động và loại đối tượng đang có trong nhật ký */
  async options() {
    const [actors, actions, targetTypes] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: number; fullName: string; email: string }>>`
        SELECT u.id, u.full_name AS "fullName", u.email
        FROM users u
        WHERE u.id IN (SELECT DISTINCT actor_id FROM activity_logs WHERE actor_id IS NOT NULL)
        ORDER BY u.full_name`,
      this.prisma.activityLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.activityLog.findMany({
        distinct: ['targetType'],
        where: { targetType: { not: null } },
        select: { targetType: true },
        orderBy: { targetType: 'asc' },
      }),
    ]);
    return {
      actors,
      actions: actions.map((a) => a.action),
      targetTypes: targetTypes.map((t) => t.targetType as string),
    };
  }
}
