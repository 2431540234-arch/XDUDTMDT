// UC-ADM – Quản trị nội dung: FAQ theo chủ đề (lưu trong settings, khóa `faq`).
import { Injectable } from '@nestjs/common';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { toSlug } from '../../common/utils/slug';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentService } from './content.service';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly activity: ActivityLogService,
  ) {}

  // ------------------------------------------------------------ FAQ (lưu trong settings, khóa `faq`)
  faq() {
    return this.content.faq();
  }

  /** Thay toàn bộ danh sách FAQ: [{ key?, label, items: [{ question, answer }] }]; văn bản thuần (FE escape khi hiển thị) */
  async saveFaq(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const topics = Array.isArray(b.topics) ? (b.topics as Array<Record<string, unknown>>) : null;
    if (!topics) errs.add('topics', 'Danh sách chủ đề không hợp lệ.');
    errs.throwIfAny();
    const used = new Set<string>();
    const value = topics!.map((t, i) => {
      const label = str(t.label).trim();
      if (label.length < 2) errs.add(`topics.${i}.label`, 'Vui lòng nhập tên chủ đề.');
      let key = str(t.key).trim() || toSlug(label) || `chu-de-${i + 1}`;
      for (let n = 2; used.has(key); n++) key = `${key}-${n}`;
      used.add(key);
      const items = Array.isArray(t.items) ? (t.items as Array<Record<string, unknown>>) : [];
      return {
        key,
        label,
        items: items.map((it, j) => {
          const question = str(it.question).trim();
          const answer = str(it.answer).trim();
          if (question.length < 5) errs.add(`topics.${i}.items.${j}.question`, 'Câu hỏi tối thiểu 5 ký tự.');
          if (answer.length < 5) errs.add(`topics.${i}.items.${j}.answer`, 'Câu trả lời tối thiểu 5 ký tự.');
          return { question, answer };
        }),
      };
    });
    errs.throwIfAny();
    await this.prisma.setting.upsert({
      where: { key: 'faq' },
      update: { value },
      create: { key: 'faq', value, description: 'Câu hỏi thường gặp theo chủ đề' },
    });
    await this.activity.log({ actorId: adminId, action: 'faq.update', targetType: 'setting', targetId: 0 });
    return this.content.faq();
  }
}
