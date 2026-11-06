// UC-ADM – Hỏi đáp: danh sách theo tab (Tất cả / Chưa trả lời / Đã trả lời / Ẩn), trả lời, sửa câu trả lời, ẩn/hiện,
// chọn hiển thị công khai. Trả lời (mới hoặc đổi nội dung) ⇒ thông báo cho khách. Trang sản phẩm chỉ hiện câu đã trả lời + công khai.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { asBody, FieldErrors, str } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QUESTION_INCLUDE, QuestionsService } from './questions.service';

@Injectable()
export class AdminQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: RawQuery) {
    const status = qStr(q, 'status');
    const search = foldVi(qStr(q, 'q'));
    const where: Prisma.ProductQuestionWhereInput =
      status && ['unanswered', 'answered', 'hidden'].includes(status) ? { status: status as never } : {};
    const rows = await this.prisma.productQuestion.findMany({
      where,
      include: QUESTION_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    let list = rows.map((r) => this.questions.toView(r));
    if (search)
      list = list.filter((x) => foldVi(`${x.productName} ${x.userName} ${x.content}`).includes(search));
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  /** { answer, isPublic } trả lời/sửa · { status: "hidden" } ẩn · { status: "visible" } hiện lại (về đã trả lời/chưa trả lời) */
  async update(adminId: number, id: number, raw: unknown) {
    const b = asBody(raw);
    const cur = await this.prisma.productQuestion.findUnique({ where: { id }, include: { product: true } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Câu hỏi không tồn tại.');
    let data: Prisma.ProductQuestionUpdateInput;
    let notifyUser = false;
    if (b.status === 'hidden') {
      data = { status: 'hidden', isPublic: false };
    } else if (b.status === 'visible' && b.answer === undefined) {
      data = {
        status: cur.answer ? 'answered' : 'unanswered',
        isPublic: b.isPublic !== undefined ? Boolean(b.isPublic) : true,
      };
    } else {
      const answer = str(b.answer).trim();
      if (answer.length < 5) new FieldErrors().add('answer', 'Câu trả lời tối thiểu 5 ký tự.').throwIfAny();
      if (answer.length > 2000)
        new FieldErrors().add('answer', 'Câu trả lời tối đa 2000 ký tự.').throwIfAny();
      data = {
        answer,
        answeredBy: 'Aurelia Living',
        answeredAt: new Date(),
        isPublic: b.isPublic !== false,
        status: 'answered',
      };
      notifyUser = answer !== cur.answer;
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.productQuestion.update({ where: { id }, data, include: QUESTION_INCLUDE });
      if (notifyUser) {
        await this.notifications.notify(
          tx,
          cur.userId,
          'Câu hỏi của bạn đã được trả lời',
          'system',
          `Aurelia Living đã trả lời câu hỏi về "${cur.product.name}".`,
          `/products/${cur.product.slug}`,
        );
      }
      await this.activity.log(
        {
          actorId: adminId,
          action: b.status === 'hidden' ? 'question.hide' : 'question.answer',
          targetType: 'question',
          targetId: id,
        },
        tx,
      );
      return r;
    });
    return this.questions.toView(row);
  }
}
