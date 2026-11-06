// Nội dung công khai: banner, bài viết, trang tĩnh/chính sách, FAQ, liên hệ, cài đặt cửa hàng công khai.
// Bảng: banners, posts, pages, faq_topics, faq_items, contact_messages, settings
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { EMAIL_RE, FieldErrors, PHONE_RE, asBody, str } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
  ) {}

  // ---------------- banner ----------------
  bannerView(b: {
    id: number;
    title: string;
    subtitle: string | null;
    link: string;
    position: string;
    startAt: Date;
    endAt: Date | null;
    sortOrder: number;
    isActive: boolean;
    image: { filePath: string };
  }) {
    return {
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: this.views.url(b.image.filePath) ?? '',
      link: b.link,
      position: b.position.replace(/_/g, '-'), // enum Prisma hero_1 → giá trị contract 'hero-1'
      startAt: b.startAt.toISOString(),
      endAt: b.endAt ? b.endAt.toISOString() : null,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    };
  }

  /** Banner đang hiển thị (bật, trong khoảng thời gian), theo vị trí rồi thứ tự */
  async banners() {
    const now = new Date();
    const rows = await this.prisma.banner.findMany({
      where: { isActive: true, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gte: now } }] },
      include: { image: true },
    });
    return rows
      .map((b) => this.bannerView(b))
      .sort((a, b) => a.position.localeCompare(b.position) || a.sortOrder - b.sortOrder);
  }

  // ---------------- bài viết ----------------
  postView(p: {
    id: number;
    title: string;
    slug: string;
    category: string;
    content: string;
    authorName: string;
    status: string;
    views: number;
    publishedAt: Date | null;
    createdAt: Date;
    cover: { filePath: string };
  }) {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      coverUrl: this.views.url(p.cover.filePath) ?? '',
      content: p.content,
      authorName: p.authorName,
      status: p.status === 'published' ? 'published' : 'draft',
      views: p.views,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  async posts() {
    const rows = await this.prisma.post.findMany({
      where: { status: 'published' },
      include: { cover: true },
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    });
    return rows.map((p) => this.postView(p));
  }

  /** Chi tiết bài viết đã xuất bản (tăng lượt xem) */
  async postBySlug(slug: string) {
    const p = await this.prisma.post.findFirst({
      where: { slug, status: 'published' },
      include: { cover: true },
    });
    if (!p) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Bài viết không tồn tại.');
    const updated = await this.prisma.post.update({
      where: { id: p.id },
      data: { views: { increment: 1 } },
      include: { cover: true },
    });
    return this.postView(updated);
  }

  // ---------------- trang tĩnh ----------------
  async pageBySlug(slug: string) {
    const p = await this.prisma.page.findFirst({ where: { slug, status: 'published' } });
    if (!p) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Trang không tồn tại.');
    return p;
  }

  /** Danh sách chính sách (type=policy) để dựng menu footer */
  async policies() {
    const rows = await this.prisma.page.findMany({
      where: { type: 'policy', status: 'published' },
      orderBy: { id: 'asc' },
      select: { slug: true, title: true },
    });
    return rows;
  }

  // ---------------- FAQ ----------------
  async faq() {
    const topics = await this.prisma.faqTopic.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return topics.map((t) => ({
      key: t.key,
      label: t.label,
      items: t.items.map((i) => ({ id: i.id, question: i.question, answer: i.answer })),
    }));
  }

  // ---------------- liên hệ ----------------
  async contact(raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    if (str(b.fullName).trim().length < 2) errs.add('fullName', 'Vui lòng nhập họ và tên.');
    if (!PHONE_RE.test(str(b.phone))) errs.add('phone', 'Số điện thoại phải gồm 10 chữ số.');
    if (!EMAIL_RE.test(str(b.email))) errs.add('email', 'Email không hợp lệ.');
    if (!str(b.subject)) errs.add('subject', 'Vui lòng chọn chủ đề.');
    if (str(b.content).trim().length < 10) errs.add('content', 'Nội dung tối thiểu 10 ký tự.');
    errs.throwIfAny();
    await this.prisma.contactMessage.create({
      data: {
        fullName: str(b.fullName).trim(),
        phone: str(b.phone),
        email: str(b.email).trim(),
        subject: str(b.subject),
        content: str(b.content).trim(),
      },
    });
    return null;
  }

  // ---------------- cài đặt công khai ----------------
  async publicSettings() {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: ['store', 'payments', 'shippingZones'] } },
    });
    const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;
    return {
      store: get('store'),
      payments: get('payments') ?? [],
      shippingZones: get('shippingZones') ?? [],
    };
  }
}
