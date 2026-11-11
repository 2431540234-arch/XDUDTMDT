// UC-ADM-26 – Gửi thông báo cho người dùng: một hoặc nhiều user, hoặc tất cả. Bảng: notifications (C), users (R), activity_logs (C).
// Thông báo tạo cùng activity_logs trong MỘT transaction (D-T52). Khách thấy ở chuông như thông báo hệ thống (data.type = 'system').
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_RECIPIENTS = 1000;
const CHUNK = 500;

@Injectable()
export class AdminNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** POST /admin/notifications { title, content, type?: system|promo, link?, userIds?: number[], all?: boolean } ⇒ { sent } */
  async send(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const title = str(b.title).trim();
    const content = str(b.content).trim();
    const link =
      b.link === undefined || b.link === null || str(b.link).trim() === '' ? null : str(b.link).trim();
    const type = b.type === undefined || b.type === '' ? 'system' : str(b.type);
    if (title.length < 2 || title.length > 150) errs.add('title', 'Tiêu đề từ 2 đến 150 ký tự.');
    if (content.length < 1 || content.length > 2000) errs.add('content', 'Nội dung từ 1 đến 2000 ký tự.');
    if (!['system', 'promo'].includes(type)) errs.add('type', 'Loại thông báo phải là system hoặc promo.');
    if (link !== null && (link.length > 255 || !/^(\/[^\s]*|https?:\/\/[^\s]+)$/.test(link)))
      errs.add('link', 'Liên kết phải bắt đầu bằng "/" hoặc http(s)://.');
    const all = b.all === true;
    const rawIds = Array.isArray(b.userIds) ? b.userIds : undefined;
    if (all && rawIds?.length)
      errs.add('userIds', 'Chọn "tất cả" hoặc danh sách người nhận, không chọn cả hai.');
    if (!all && !rawIds?.length) errs.add('userIds', 'Vui lòng chọn người nhận.');
    let ids: number[] = [];
    if (rawIds?.length) {
      if (rawIds.length > MAX_RECIPIENTS) errs.add('userIds', `Tối đa ${MAX_RECIPIENTS} người nhận mỗi lần.`);
      else if (!rawIds.every((x) => Number.isInteger(x) && (x as number) > 0))
        errs.add('userIds', 'Mã người nhận không hợp lệ.');
      else ids = [...new Set(rawIds as number[])];
    }
    errs.throwIfAny();

    // người nhận: tài khoản còn hoạt động (chưa xóa mềm, không bị cấm); "tất cả" = mọi tài khoản như vậy
    const recipients = await this.prisma.user.findMany({
      where: all
        ? { deletedAt: null, status: { not: 'banned' } }
        : { id: { in: ids }, deletedAt: null, status: { not: 'banned' } },
      select: { id: true },
    });
    if (!all) {
      const found = new Set(recipients.map((r) => r.id));
      const missing = ids.filter((i) => !found.has(i));
      if (missing.length)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          userIds: [`Không tìm thấy người nhận: ${missing.slice(0, 10).join(', ')}.`],
        });
    }
    if (!recipients.length)
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
        userIds: ['Không có người nhận hợp lệ.'],
      });

    const data = { type, content, link };
    await this.prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < recipients.length; i += CHUNK) {
          await tx.notification.createMany({
            data: recipients.slice(i, i + CHUNK).map((r) => ({ userId: r.id, title, data })),
          });
        }
        await this.activity.log(
          {
            actorId: adminId,
            action: 'notification.send',
            targetType: 'notification',
            changes: { title, type, link, all, recipients: recipients.length },
          },
          tx,
        );
      },
      { timeout: 30_000 },
    );
    return { sent: recipients.length };
  }
}
