// UC-ADM – Quản trị nội dung: banner (CRUD, upload ảnh, vị trí, thời gian, kéo thả sắp xếp), bài viết (rich text đã lọc
// XSS, slug unique, nháp/xuất bản), trang tĩnh & chính sách, FAQ theo chủ đề, tin nhắn liên hệ (đánh dấu đã xử lý).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { toSlug } from '../../common/utils/slug';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentService } from './content.service';

const POSITIONS = ['hero-1', 'hero-2', 'hero-3', 'home-left', 'home-right', 'home-3d'];
/** Giá trị DB 'hero-1' ↔ tên enum Prisma hero_1 */
const toPrismaPosition = (p: string) => p.replace(/-/g, '_') as never;
const CORE_PAGES = [
  've-chung-toi',
  'chinh-sach-mua-hang',
  'chinh-sach-doi-tra',
  'chinh-sach-bao-hanh',
  'chinh-sach-bao-mat',
  'dieu-khoan-su-dung',
  'chinh-sach-van-chuyen',
];

/** Lọc HTML rich text: giữ thẻ định dạng cơ bản, bỏ script/style/sự kiện on*, chỉ cho http(s)/mailto/đường dẫn tương đối */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'p',
      'br',
      'hr',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'figure',
      'figcaption',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'span',
      'div',
      'code',
      'pre',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  });
}

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly ingest: MediaIngestService,
    private readonly activity: ActivityLogService,
  ) {}

  // ------------------------------------------------------------ banner
  async banners() {
    const rows = await this.prisma.banner.findMany({ include: { image: true } });
    return rows
      .map((b) => this.content.bannerView(b))
      .sort((a, b) => a.position.localeCompare(b.position) || a.sortOrder - b.sortOrder);
  }

  async saveBanner(adminId: number, id: number | null, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    if ((!id || b.title !== undefined) && str(b.title).trim().length < 2)
      errs.add('title', 'Vui lòng nhập tiêu đề banner.');
    if (!b.imageUrl && !id) errs.add('imageUrl', 'Vui lòng tải ảnh banner.');
    if (b.position !== undefined && !POSITIONS.includes(str(b.position)))
      errs.add('position', 'Vị trí banner không hợp lệ.');
    if (b.startAt && Number.isNaN(Date.parse(str(b.startAt))))
      errs.add('startAt', 'Ngày bắt đầu không hợp lệ.');
    if (b.endAt && Number.isNaN(Date.parse(str(b.endAt)))) errs.add('endAt', 'Ngày kết thúc không hợp lệ.');
    if (b.startAt && b.endAt && Date.parse(str(b.endAt)) <= Date.parse(str(b.startAt)))
      errs.add('endAt', 'Ngày kết thúc phải sau ngày bắt đầu.');
    errs.throwIfAny();
    const cur = id ? await this.prisma.banner.findUnique({ where: { id } }) : null;
    if (id && !cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Banner không tồn tại.');
    const imageMediaId = b.imageUrl
      ? await this.ingest.ingestImage(str(b.imageUrl), { userId: adminId, folder: 'banners' })
      : cur!.imageMediaId;
    const max = await this.prisma.banner.aggregate({ _max: { sortOrder: true } });
    const data = {
      title: b.title !== undefined ? str(b.title).trim() : cur!.title,
      subtitle: b.subtitle !== undefined ? str(b.subtitle) || null : (cur?.subtitle ?? null),
      imageMediaId,
      link: str(b.link) || cur?.link || '/',
      position: b.position ? toPrismaPosition(str(b.position)) : (cur?.position ?? ('hero_1' as never)),
      startAt: b.startAt ? new Date(str(b.startAt)) : (cur?.startAt ?? new Date()),
      endAt: b.endAt === undefined ? (cur?.endAt ?? null) : b.endAt ? new Date(str(b.endAt)) : null,
      sortOrder:
        b.sortOrder !== undefined ? Number(b.sortOrder) : (cur?.sortOrder ?? (max._max.sortOrder ?? 0) + 1),
      isActive: b.isActive !== undefined ? Boolean(b.isActive) : (cur?.isActive ?? true),
    };
    const row = cur
      ? await this.prisma.banner.update({ where: { id: cur.id }, data, include: { image: true } })
      : await this.prisma.banner.create({ data, include: { image: true } });
    await this.activity.log({
      actorId: adminId,
      action: cur ? 'banner.update' : 'banner.create',
      targetType: 'banner',
      targetId: row.id,
    });
    return this.content.bannerView(row);
  }

  async deleteBanner(adminId: number, id: number) {
    if (!(await this.prisma.banner.findUnique({ where: { id } })))
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Banner không tồn tại.');
    await this.prisma.banner.delete({ where: { id } });
    await this.activity.log({
      actorId: adminId,
      action: 'banner.delete',
      targetType: 'banner',
      targetId: id,
    });
    return null;
  }

  /** Lưu thứ tự kéo thả: ids theo thứ tự mới ⇒ sortOrder = 1..n */
  async reorderBanners(adminId: number, raw: unknown) {
    const ids = Array.isArray(asBody(raw).ids)
      ? (asBody(raw).ids as unknown[]).map(toId).filter(Boolean)
      : [];
    if (!ids.length) new FieldErrors().add('ids', 'Danh sách banner không hợp lệ.').throwIfAny();
    const found = await this.prisma.banner.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size)
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Có banner không tồn tại.');
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.banner.update({ where: { id }, data: { sortOrder: i + 1 } })),
    );
    await this.activity.log({
      actorId: adminId,
      action: 'banner.reorder',
      targetType: 'banner',
      changes: { ids },
    });
    return this.banners();
  }

  // ------------------------------------------------------------ bài viết
  async posts() {
    const rows = await this.prisma.post.findMany({
      include: { cover: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((p) => this.content.postView(p));
  }

  async savePost(adminId: number, id: number | null, raw: unknown) {
    const b = asBody(raw);
    if ((!id || b.title !== undefined) && str(b.title).trim().length < 5)
      new FieldErrors().add('title', 'Tiêu đề tối thiểu 5 ký tự.').throwIfAny();
    if (b.status !== undefined && !['draft', 'published'].includes(str(b.status)))
      new FieldErrors().add('status', 'Trạng thái không hợp lệ.').throwIfAny();
    const cur = id ? await this.prisma.post.findUnique({ where: { id } }) : null;
    if (id && !cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Bài viết không tồn tại.');
    const title = b.title !== undefined ? str(b.title).trim() : cur!.title;
    let slug = cur && toSlug(cur.title) === toSlug(title) ? cur.slug : toSlug(b.slug ? str(b.slug) : title);
    if (!slug) new FieldErrors().add('slug', 'Slug không hợp lệ.').throwIfAny();
    const base = slug;
    for (
      let n = 2;
      await this.prisma.post.findFirst({ where: { slug, ...(cur ? { id: { not: cur.id } } : {}) } });
      n++
    )
      slug = `${base}-${n}`;

    let coverMediaId = cur?.coverMediaId;
    if (b.coverUrl)
      coverMediaId = await this.ingest.ingestImage(str(b.coverUrl), { userId: adminId, folder: 'posts' });
    if (!coverMediaId) {
      // chưa có ảnh bìa: dùng ảnh bìa của bài gần nhất để bài nháp vẫn lưu được
      const any = await this.prisma.post.findFirst({ orderBy: { id: 'desc' } });
      if (!any) new FieldErrors().add('coverUrl', 'Vui lòng tải ảnh bìa.').throwIfAny();
      coverMediaId = any!.coverMediaId;
    }
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { fullName: true } });
    const status = (str(b.status) || cur?.status || 'draft') as 'draft' | 'published';
    const data: Prisma.PostUncheckedCreateInput = {
      title,
      slug,
      category: str(b.category) || cur?.category || 'Cảm hứng',
      coverMediaId: coverMediaId!,
      content: b.content !== undefined ? sanitizeRichText(str(b.content)) : (cur?.content ?? ''),
      authorName: cur?.authorName ?? admin?.fullName ?? 'Aurelia Living',
      status,
      publishedAt: status === 'published' ? (cur?.publishedAt ?? new Date()) : (cur?.publishedAt ?? null),
    };
    const row = cur
      ? await this.prisma.post.update({ where: { id: cur.id }, data, include: { cover: true } })
      : await this.prisma.post.create({ data, include: { cover: true } });
    await this.activity.log({
      actorId: adminId,
      action: cur ? 'post.update' : 'post.create',
      targetType: 'post',
      targetId: row.id,
    });
    return this.content.postView(row);
  }

  async deletePost(adminId: number, id: number) {
    if (!(await this.prisma.post.findUnique({ where: { id } })))
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Bài viết không tồn tại.');
    await this.prisma.post.delete({ where: { id } });
    await this.activity.log({ actorId: adminId, action: 'post.delete', targetType: 'post', targetId: id });
    return null;
  }

  // ------------------------------------------------------------ trang tĩnh
  pages() {
    return this.prisma.page.findMany({ orderBy: { id: 'asc' } });
  }

  async savePage(adminId: number, id: number | null, raw: unknown) {
    const b = asBody(raw);
    const cur = id ? await this.prisma.page.findUnique({ where: { id } }) : null;
    if (id && !cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Trang không tồn tại.');
    const errs = new FieldErrors();
    if (!cur && str(b.title).trim().length < 2) errs.add('title', 'Vui lòng nhập tiêu đề trang.');
    if (b.title !== undefined && str(b.title).trim().length < 2)
      errs.add('title', 'Vui lòng nhập tiêu đề trang.');
    if (b.status !== undefined && !['draft', 'published', 'archived'].includes(str(b.status)))
      errs.add('status', 'Trạng thái không hợp lệ.');
    errs.throwIfAny();
    let slug = cur?.slug;
    if (!cur) {
      slug = toSlug(str(b.slug) || str(b.title));
      if (!slug || (await this.prisma.page.findUnique({ where: { slug } })))
        new FieldErrors().add('slug', 'Slug đã tồn tại hoặc không hợp lệ.').throwIfAny();
    }
    const status = (b.status ? str(b.status) : (cur?.status ?? 'draft')) as
      'draft' | 'published' | 'archived';
    const data = {
      ...(b.title !== undefined ? { title: str(b.title).trim() } : {}),
      ...(b.content !== undefined ? { content: sanitizeRichText(str(b.content)) } : {}),
      status,
      publishedAt: status === 'published' ? (cur?.publishedAt ?? new Date()) : (cur?.publishedAt ?? null),
    };
    const row = cur
      ? await this.prisma.page.update({ where: { id: cur.id }, data })
      : await this.prisma.page.create({
          data: {
            title: str(b.title).trim(),
            slug: slug!,
            type: b.type === 'policy' ? 'policy' : 'static',
            content: data.content ?? '',
            status,
            publishedAt: data.publishedAt,
          },
        });
    await this.activity.log({
      actorId: adminId,
      action: cur ? 'page.update' : 'page.create',
      targetType: 'page',
      targetId: row.id,
    });
    return row;
  }

  async deletePage(adminId: number, id: number) {
    const p = await this.prisma.page.findUnique({ where: { id } });
    if (!p) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Trang không tồn tại.');
    if (CORE_PAGES.includes(p.slug))
      throw new AppException(
        ErrorCode.RESOURCE_IN_USE,
        'Không thể xóa trang hệ thống (Về chúng tôi, chính sách).',
      );
    await this.prisma.page.delete({ where: { id } });
    await this.activity.log({ actorId: adminId, action: 'page.delete', targetType: 'page', targetId: id });
    return null;
  }

  // ------------------------------------------------------------ FAQ
  async faq() {
    const topics = await this.prisma.faqTopic.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return topics.map((t) => ({
      id: t.id,
      key: t.key,
      label: t.label,
      sortOrder: t.sortOrder,
      items: t.items,
    }));
  }

  async saveTopic(adminId: number, id: number | null, raw: unknown) {
    const b = asBody(raw);
    const cur = id ? await this.prisma.faqTopic.findUnique({ where: { id } }) : null;
    if (id && !cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Chủ đề không tồn tại.');
    if (str(b.label).trim().length < 2)
      new FieldErrors().add('label', 'Vui lòng nhập tên chủ đề.').throwIfAny();
    const key = cur?.key ?? toSlug(str(b.key) || str(b.label));
    if (!cur && (await this.prisma.faqTopic.findUnique({ where: { key } })))
      new FieldErrors().add('label', 'Chủ đề đã tồn tại.').throwIfAny();
    const data = {
      label: str(b.label).trim(),
      ...(b.sortOrder !== undefined ? { sortOrder: Number(b.sortOrder) } : {}),
    };
    const row = cur
      ? await this.prisma.faqTopic.update({ where: { id: cur.id }, data })
      : await this.prisma.faqTopic.create({ data: { ...data, key } });
    await this.activity.log({
      actorId: adminId,
      action: cur ? 'faq.topic_update' : 'faq.topic_create',
      targetType: 'faq_topic',
      targetId: row.id,
    });
    return row;
  }

  async deleteTopic(adminId: number, id: number) {
    if (!(await this.prisma.faqTopic.findUnique({ where: { id } })))
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Chủ đề không tồn tại.');
    await this.prisma.faqTopic.delete({ where: { id } });
    await this.activity.log({
      actorId: adminId,
      action: 'faq.topic_delete',
      targetType: 'faq_topic',
      targetId: id,
    });
    return null;
  }

  async saveItem(adminId: number, id: number | null, raw: unknown) {
    const b = asBody(raw);
    const cur = id ? await this.prisma.faqItem.findUnique({ where: { id } }) : null;
    if (id && !cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Câu hỏi không tồn tại.');
    const errs = new FieldErrors();
    if (str(b.question).trim().length < 5) errs.add('question', 'Câu hỏi tối thiểu 5 ký tự.');
    if (str(b.answer).trim().length < 5) errs.add('answer', 'Câu trả lời tối thiểu 5 ký tự.');
    const topicId = b.topicId ? toId(b.topicId) : cur?.topicId;
    if (!topicId || !(await this.prisma.faqTopic.findUnique({ where: { id: topicId } })))
      errs.add('topicId', 'Vui lòng chọn chủ đề.');
    errs.throwIfAny();
    const data = {
      topicId: topicId!,
      question: str(b.question).trim(),
      answer: sanitizeRichText(str(b.answer)),
      ...(b.sortOrder !== undefined ? { sortOrder: Number(b.sortOrder) } : {}),
    };
    const row = cur
      ? await this.prisma.faqItem.update({ where: { id: cur.id }, data })
      : await this.prisma.faqItem.create({ data });
    await this.activity.log({
      actorId: adminId,
      action: cur ? 'faq.item_update' : 'faq.item_create',
      targetType: 'faq_item',
      targetId: row.id,
    });
    return row;
  }

  async deleteItem(adminId: number, id: number) {
    if (!(await this.prisma.faqItem.findUnique({ where: { id } })))
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Câu hỏi không tồn tại.');
    await this.prisma.faqItem.delete({ where: { id } });
    await this.activity.log({
      actorId: adminId,
      action: 'faq.item_delete',
      targetType: 'faq_item',
      targetId: id,
    });
    return null;
  }

  // ------------------------------------------------------------ liên hệ
  async contactMessages(q: RawQuery) {
    const handled = qStr(q, 'handled');
    const where: Prisma.ContactMessageWhereInput =
      handled === 'true' ? { handledAt: { not: null } } : handled === 'false' ? { handledAt: null } : {};
    const total = await this.prisma.contactMessage.count({ where });
    const page = resolvePage(q, total, 10);
    const rows = await this.prisma.contactMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: rows, page: page.page, pageSize: page.pageSize, total };
  }

  async markHandled(adminId: number, id: number, raw: unknown) {
    const m = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!m) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tin nhắn không tồn tại.');
    const handled = asBody(raw).handled !== false;
    const row = await this.prisma.contactMessage.update({
      where: { id },
      data: { handledAt: handled ? new Date() : null, handledBy: handled ? adminId : null },
    });
    await this.activity.log({
      actorId: adminId,
      action: 'contact.handle',
      targetType: 'contact_message',
      targetId: id,
      changes: { handled },
    });
    return row;
  }
}
