// M13b – Hỏi đáp sản phẩm: khách đặt câu hỏi, danh sách câu đã trả lời công khai. Bảng: product_questions
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

export const QUESTION_INCLUDE = {
  user: { select: { fullName: true } },
  product: { include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } } },
} satisfies Prisma.ProductQuestionInclude;

export type QuestionRow = Prisma.ProductQuestionGetPayload<{ include: typeof QUESTION_INCLUDE }>;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly products: ProductsService,
  ) {}

  /** ProductQuestion theo contract */
  toView(q: QuestionRow) {
    return {
      id: q.id,
      productId: q.productId,
      productName: q.product.name,
      productSlug: q.product.slug,
      productImageUrl: this.views.url(q.product.productImages[0]?.media.filePath),
      userId: q.userId,
      userName: q.user.fullName,
      content: q.content,
      answer: q.answer,
      answeredBy: q.answeredBy,
      answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
      isPublic: q.isPublic,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
    };
  }

  async publicList(slug: string) {
    const p = await this.products.bySlug(slug);
    const rows = await this.prisma.productQuestion.findMany({
      where: { productId: p.id, status: 'answered', isPublic: true },
      include: QUESTION_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  async ask(userId: number, slug: string, raw: unknown) {
    const p = await this.products.bySlug(slug);
    const content = str(asBody(raw).content).trim();
    if (content.length < 10) new FieldErrors().add('content', 'Câu hỏi tối thiểu 10 ký tự.').throwIfAny();
    const row = await this.prisma.productQuestion.create({
      data: { productId: p.id, userId, content },
      include: QUESTION_INCLUDE,
    });
    if (!row) throw new AppException(ErrorCode.INTERNAL_ERROR, 'Không gửi được câu hỏi.');
    return this.toView(row);
  }
}
