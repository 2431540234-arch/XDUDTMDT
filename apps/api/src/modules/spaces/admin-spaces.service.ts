// UC-ADM – Quản trị không gian mẫu (5 tab): thông tin cơ bản · ảnh 360° (upload, sắp xếp) · điểm tương tác (hotspot yaw/pitch →
// sản phẩm, kiểm tra tồn tại) · sản phẩm gợi ý · cài đặt hiển thị (trạng thái, % giảm combo).
// Giá combo do server tính từ giá hiện tại của sản phẩm trong không gian (xem SpacesService.calcComboTotal).
import { Injectable } from '@nestjs/common';
import { RoomType } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { toSlug } from '../../common/utils/slug';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { SPACE_INCLUDE, SpacesService } from './spaces.service';

const ROOM_TYPES: RoomType[] = [
  'living_room',
  'bedroom',
  'kitchen',
  'dining_room',
  'bathroom',
  'office',
  'other',
];
const STATUSES = ['draft', 'published', 'archived'];
const SORTS = ['title', 'viewCount', 'createdAt'];

interface HotspotInput {
  type?: string;
  yaw?: unknown;
  pitch?: unknown;
  productId?: unknown;
  variantId?: unknown;
  targetIndex?: unknown;
  targetPanoramaId?: unknown;
  title?: unknown;
  content?: unknown;
}
interface PanoInput {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  isStart?: unknown;
  hotspots?: HotspotInput[];
}

@Injectable()
export class AdminSpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly ingest: MediaIngestService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
  ) {}

  async list(q: RawQuery) {
    const room = qStr(q, 'roomType');
    const status = qStr(q, 'status');
    const search = foldVi(qStr(q, 'q'));
    const rows = await this.prisma.space.findMany({
      where: {
        ...(room ? { roomType: room as RoomType } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: SPACE_INCLUDE,
    });
    let list = this.spaces.adminListItems(rows);
    if (search) list = list.filter((s) => foldVi(`${s.title} ${s.style ?? ''}`).includes(search));
    const [field, dir] = (qStr(q, 'sort') || 'createdAt:desc').split(':');
    const f = SORTS.includes(field) ? field : 'createdAt';
    const mul = dir === 'asc' ? 1 : -1;
    const get = (s: (typeof list)[number]): string | number =>
      f === 'title'
        ? s.title
        : f === 'viewCount'
          ? s.viewCount
          : new Date(s.createdAt as unknown as string | Date).getTime();
    list.sort((a, b) => (get(a) === get(b) ? 0 : get(a) < get(b) ? -1 : 1) * mul);
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  get(id: number) {
    return this.spaces.adminDetail(id);
  }

  private validate(b: Record<string, unknown>) {
    const errs = new FieldErrors();
    if (str(b.title).trim().length < 2) errs.add('title', 'Vui lòng nhập tên không gian.');
    if (!b.roomType || !ROOM_TYPES.includes(str(b.roomType) as RoomType))
      errs.add('roomType', 'Vui lòng chọn loại không gian.');
    if (str(b.description).trim().length < 10) errs.add('description', 'Mô tả tối thiểu 10 ký tự.');
    if (b.status !== undefined && !STATUSES.includes(str(b.status)))
      errs.add('status', 'Trạng thái không hợp lệ.');
    if (
      b.comboDiscountPercent !== undefined &&
      !(Number(b.comboDiscountPercent) >= 0 && Number(b.comboDiscountPercent) <= 50)
    ) {
      errs.add('comboDiscountPercent', 'Phần trăm giảm combo từ 0 đến 50.');
    }
    errs.throwIfAny();
  }

  /** Kiểm tra hotspot: tọa độ hợp lệ, sản phẩm (và biến thể) tồn tại, điểm điều hướng trỏ tới ảnh có trong danh sách */
  private async validatePanoramas(panos: PanoInput[]) {
    const errs = new FieldErrors();
    const productIds = new Set<number>();
    panos.forEach((p, i) => {
      if (!p.url) errs.add(`panoramas.${i}.url`, 'Thiếu ảnh 360°.');
      (p.hotspots ?? []).forEach((h, j) => {
        const yaw = Number(h.yaw);
        const pitch = Number(h.pitch);
        if (!(yaw >= -180 && yaw <= 360))
          errs.add(`panoramas.${i}.hotspots.${j}.yaw`, 'Góc yaw không hợp lệ.');
        if (!(pitch >= -90 && pitch <= 90))
          errs.add(`panoramas.${i}.hotspots.${j}.pitch`, 'Góc pitch phải từ -90 đến 90.');
        if (!['product', 'navigation', 'info'].includes(str(h.type)))
          errs.add(`panoramas.${i}.hotspots.${j}.type`, 'Loại điểm tương tác không hợp lệ.');
        if (h.type === 'product') {
          if (!toId(h.productId))
            errs.add(`panoramas.${i}.hotspots.${j}.productId`, 'Vui lòng chọn sản phẩm.');
          else productIds.add(toId(h.productId));
        }
        if (
          h.type === 'navigation' &&
          h.targetIndex !== undefined &&
          h.targetIndex !== null &&
          !(Number(h.targetIndex) >= 0 && Number(h.targetIndex) < panos.length)
        ) {
          errs.add(`panoramas.${i}.hotspots.${j}.targetIndex`, 'Ảnh đích không tồn tại.');
        }
      });
    });
    errs.throwIfAny();
    if (productIds.size) {
      const found = await this.prisma.product.findMany({
        where: { id: { in: [...productIds] }, deletedAt: null },
        select: { id: true },
      });
      const have = new Set(found.map((f) => f.id));
      const bad = [...productIds].filter((id) => !have.has(id));
      if (bad.length)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          panoramas: [`Sản phẩm không tồn tại: ${bad.join(', ')}`],
        });
    }
    // biến thể (nếu gửi) phải thuộc đúng sản phẩm
    for (const [i, p] of panos.entries()) {
      for (const [j, h] of (p.hotspots ?? []).entries()) {
        if (h.type === 'product' && h.variantId) {
          const ok = await this.prisma.productVariant.findFirst({
            where: { id: toId(h.variantId), productId: toId(h.productId) },
            select: { id: true },
          });
          if (!ok)
            new FieldErrors()
              .add(`panoramas.${i}.hotspots.${j}.variantId`, 'Biến thể không thuộc sản phẩm.')
              .throwIfAny();
        }
      }
    }
  }

  private async write(adminId: number, id: number | null, raw: unknown) {
    const b = asBody(raw);
    const cur = id
      ? await this.prisma.space.findUnique({
          where: { id },
          include: { spacePanoramas: { orderBy: { sortOrder: 'asc' } } },
        })
      : null;
    if (id && !cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    const merged = cur
      ? {
          title: cur.title,
          roomType: cur.roomType,
          description: cur.description,
          style: cur.style,
          status: cur.status,
          ...b,
        }
      : b;
    this.validate(merged);
    const panos = Array.isArray(b.panoramas) ? (b.panoramas as PanoInput[]) : null;
    if (panos) await this.validatePanoramas(panos);

    const title = str(merged.title).trim();
    // Slug: đổi tên KHÔNG đổi slug (giữ liên kết/dấu trang). Chỉ đổi khi admin gửi slug mới; slug do admin chọn phải duy nhất.
    const wanted = str(b.slug).trim();
    let slug: string;
    if (wanted) {
      slug = toSlug(wanted);
      if (!slug) new FieldErrors().add('slug', 'Slug không hợp lệ.').throwIfAny();
      const taken = await this.prisma.space.findFirst({
        where: { slug, ...(cur ? { id: { not: cur.id } } : {}) },
        select: { id: true },
      });
      if (taken) new FieldErrors().add('slug', 'Slug đã được dùng cho không gian khác.').throwIfAny();
    } else if (cur) {
      slug = cur.slug;
    } else {
      // tạo mới không nhập slug: sinh từ tên, trùng thì thêm hậu tố -2, -3…
      const base = toSlug(title) || 'khong-gian';
      slug = base;
      for (let n = 2; await this.prisma.space.findFirst({ where: { slug }, select: { id: true } }); n++)
        slug = `${base}-${n}`;
    }
    const status = (str(merged.status) || 'draft') as 'draft' | 'published' | 'archived';
    const coverMediaId = b.coverUrl
      ? await this.ingest.ingestImage(str(b.coverUrl), { userId: adminId, folder: 'spaces' })
      : (cur?.coverMediaId ?? null);

    // ingest ảnh 360° trước (ngoài transaction)
    const panoMedia: number[] = [];
    if (panos)
      for (const p of panos)
        panoMedia.push(
          await this.ingest.ingestImage(str(p.url), { userId: adminId, folder: 'panoramas', maxMB: 20 }),
        );

    const spaceId = await this.prisma.$transaction(
      async (tx) => {
        const data = {
          title,
          slug,
          roomType: str(merged.roomType) as RoomType,
          style: str(merged.style) || null,
          description: str(merged.description),
          status,
          coverMediaId,
          comboDiscountPercent:
            b.comboDiscountPercent !== undefined
              ? Number(b.comboDiscountPercent)
              : cur
                ? Number(cur.comboDiscountPercent)
                : 10,
          publishedAt: status === 'published' ? (cur?.publishedAt ?? new Date()) : null,
          categoryId: b.categoryId !== undefined ? toId(b.categoryId) || null : (cur?.categoryId ?? null),
        };
        const space = cur
          ? await tx.space.update({ where: { id: cur.id }, data })
          : await tx.space.create({ data });
        if (panos) {
          const oldPanos = cur?.spacePanoramas ?? [];
          const oldIds = oldPanos.map((p) => p.id);
          const oldIndex = new Map(oldPanos.map((p, i) => [p.id, i]));
          await tx.spaceHotspot.deleteMany({ where: { panoramaId: { in: oldIds } } });
          // mô hình 3D đã đặt (UC-ADM-17) không nằm trong form này: giữ lại theo ẢNH (cùng mediaId), ảnh bị bỏ thì placement mất theo
          const oldPlacements = await tx.spaceProductPlacement.findMany({
            where: { panoramaId: { in: oldIds } },
            orderBy: { id: 'asc' },
          });
          await tx.spaceProductPlacement.deleteMany({ where: { panoramaId: { in: oldIds } } });
          await tx.spacePanorama.deleteMany({ where: { spaceId: space.id } });
          const created: number[] = [];
          for (const [i, p] of panos.entries()) {
            const row = await tx.spacePanorama.create({
              data: {
                spaceId: space.id,
                mediaId: panoMedia[i],
                title: p.title ? str(p.title) : null,
                sortOrder: i + 1,
                isStart: p.isStart !== undefined ? Boolean(p.isStart) && !created.length : i === 0,
              },
            });
            created.push(row.id);
          }
          const newByOld = new Map<number, number>();
          const usedNew = new Set<number>();
          for (const o of oldPanos) {
            const k = panoMedia.findIndex((m, i) => m === o.mediaId && !usedNew.has(i));
            if (k >= 0) {
              usedNew.add(k);
              newByOld.set(o.id, created[k]);
            }
          }
          for (const pl of oldPlacements) {
            const target = newByOld.get(pl.panoramaId);
            if (!target) continue;
            const { id: _id, panoramaId: _pid, ...rest } = pl;
            void _id;
            void _pid;
            await tx.spaceProductPlacement.create({ data: { ...rest, panoramaId: target } });
          }
          for (const [i, p] of panos.entries()) {
            for (const h of p.hotspots ?? []) {
              // điểm điều hướng: targetIndex, hoặc suy từ id ảnh cũ (FE gửi lại hotspot đã tải)
              const ti =
                h.targetIndex !== undefined && h.targetIndex !== null
                  ? Number(h.targetIndex)
                  : (oldIndex.get(toId(h.targetPanoramaId)) ?? -1);
              await tx.spaceHotspot.create({
                data: {
                  panoramaId: created[i],
                  type: str(h.type) as never,
                  yaw: Number(h.yaw),
                  pitch: Number(h.pitch),
                  productId: h.type === 'product' ? toId(h.productId) : null,
                  targetPanoramaId: h.type === 'navigation' && ti >= 0 ? (created[ti] ?? null) : null,
                  title: h.title ? str(h.title) : null,
                  content: h.content ? str(h.content) : null,
                },
              });
            }
          }
          // sản phẩm gợi ý: mỗi sản phẩm có ít nhất một điểm tương tác trên ảnh đầu; bỏ điểm của sản phẩm không còn được chọn
          if (Array.isArray(b.productIds) && created.length) {
            const want = (b.productIds as unknown[]).map(toId).filter(Boolean);
            const have = await tx.spaceHotspot.findMany({
              where: { panoramaId: { in: created }, type: 'product' },
            });
            const haveIds = new Set(have.map((h) => h.productId));
            for (const [k, pid] of want.entries()) {
              if (!haveIds.has(pid)) {
                if (!(await tx.product.findFirst({ where: { id: pid, deletedAt: null } })))
                  throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
                    productIds: [`Sản phẩm không tồn tại: ${pid}`],
                  });
                await tx.spaceHotspot.create({
                  data: {
                    panoramaId: created[0],
                    type: 'product',
                    yaw: -135 + k * 60,
                    pitch: -8,
                    productId: pid,
                  },
                });
              }
            }
            await tx.spaceHotspot.deleteMany({
              where: { panoramaId: { in: created }, type: 'product', productId: { notIn: want } },
            });
          }
        }
        await this.activity.log(
          {
            actorId: adminId,
            action: cur ? 'space.update' : 'space.create',
            targetType: 'space',
            targetId: space.id,
            changes: { title },
          },
          tx,
        );
        return space.id;
      },
      { timeout: 60_000 },
    );
    await this.products.invalidate();
    return this.spaces.adminDetail(spaceId);
  }

  create(adminId: number, raw: unknown) {
    return this.write(adminId, null, raw);
  }

  update(adminId: number, id: number, raw: unknown) {
    return this.write(adminId, id, raw);
  }

  async remove(adminId: number, id: number) {
    const s = await this.prisma.space.findUnique({ where: { id }, include: { spacePanoramas: true } });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    const panoIds = s.spacePanoramas.map((p) => p.id);
    await this.prisma.$transaction([
      this.prisma.couponScope.deleteMany({ where: { targetType: 'space', targetId: id } }),
      this.prisma.spaceHotspot.deleteMany({ where: { panoramaId: { in: panoIds } } }),
      this.prisma.spaceProductPlacement.deleteMany({ where: { panoramaId: { in: panoIds } } }),
      this.prisma.spacePanorama.deleteMany({ where: { spaceId: id } }),
      this.prisma.spaceBookmark.deleteMany({ where: { spaceId: id } }),
      this.prisma.spaceView.deleteMany({ where: { spaceId: id } }),
      this.prisma.space.delete({ where: { id } }),
    ]);
    await this.activity.log({ actorId: adminId, action: 'space.delete', targetType: 'space', targetId: id });
    return null;
  }
}
