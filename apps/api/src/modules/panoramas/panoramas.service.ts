// M13 – Không gian mẫu 360°. UC-ADM-17: đặt mô hình 3D của sản phẩm vào ảnh 360° (bảng space_product_placements).
// Vị trí tính theo hệ tọa độ của ảnh: yaw (độ, -180..180), pitch (độ, -90..90) là HƯỚNG nhìn từ tâm ảnh, `distance` là khoảng
// cách tới tâm (mét, hình cầu ảnh bán kính 50), rotationX/Y/Z là độ xoay thêm (độ), `scale` là hệ số phóng (1 = kích thước thật
// của tệp GLB). Không dùng mô hình riêng: không chọn modelId thì lấy mô hình chính (ready) của sản phẩm tại thời điểm đặt.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, toId } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Mô hình rút gọn để client dựng lại trong ảnh 360°: các LOD của GLB và cấu hình vật liệu theo biến thể */
export interface PlacementModel {
  id: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  files: Array<{ lod: string | null; url: string; fileSize: number }>;
  materialVariants: Array<{ variantId: number; materialName: string; config: unknown }>;
}

const MODEL_INCLUDE = {
  modelFiles: { include: { media: true } },
  modelMaterialVariants: true,
} satisfies Prisma.Product3DModelInclude;

type ModelRow = Prisma.Product3DModelGetPayload<{ include: typeof MODEL_INCLUDE }>;

const num = (v: unknown) =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;

@Injectable()
export class PanoramasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly views: CatalogViews,
  ) {}

  // ---------------------------------------------------------------- dựng view (dùng chung với chi tiết không gian)

  modelView(m: ModelRow): PlacementModel {
    return {
      id: m.id,
      lengthMm: Number(m.lengthMm),
      widthMm: Number(m.widthMm),
      heightMm: Number(m.heightMm),
      files: m.modelFiles
        .filter((f) => f.format === 'glb')
        .map((f) => ({
          lod: f.lod,
          url: this.views.url(f.media.filePath) ?? '',
          fileSize: Number(f.media.fileSize),
        })),
      materialVariants: m.modelMaterialVariants.map((r) => ({
        variantId: r.variantId,
        materialName: r.materialName,
        config: r.config,
      })),
    };
  }

  /** Mô hình CHÍNH đã ready của từng sản phẩm (kèm tệp, vật liệu) */
  async primaryModels(productIds: number[]): Promise<Map<number, PlacementModel>> {
    const out = new Map<number, PlacementModel>();
    if (!productIds.length) return out;
    const rows = await this.prisma.product3DModel.findMany({
      where: { productId: { in: productIds }, isPrimary: true, status: 'ready' },
      include: MODEL_INCLUDE,
    });
    for (const m of rows) out.set(m.productId, this.modelView(m));
    return out;
  }

  /**
   * Dựng view cho danh sách placement: mô hình đã chọn nếu còn `ready`, không thì mô hình chính của sản phẩm
   * (modelId bị xóa ⇒ DB đặt NULL); không có mô hình dùng được ⇒ `model: null` (client bỏ qua placement này).
   */
  async placementViews(
    rows: Array<{
      id: number;
      panoramaId: number;
      productId: number;
      variantId: number | null;
      modelId: number | null;
      yaw: unknown;
      pitch: unknown;
      distance: unknown;
      rotationX: unknown;
      rotationY: unknown;
      rotationZ: unknown;
      scale: unknown;
    }>,
  ) {
    if (!rows.length) return [];
    const modelIds = [...new Set(rows.map((r) => r.modelId).filter((x): x is number => x !== null))];
    const chosen = modelIds.length
      ? await this.prisma.product3DModel.findMany({
          where: { id: { in: modelIds }, status: 'ready' },
          include: MODEL_INCLUDE,
        })
      : [];
    const byId = new Map(chosen.map((m) => [m.id, this.modelView(m)]));
    const prim = await this.primaryModels([...new Set(rows.map((r) => r.productId))]);
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.productId))] } },
      select: { id: true, name: true, slug: true, categoryId: true },
    });
    const pById = new Map(products.map((p) => [p.id, p]));
    return rows.map((r) => ({
      id: r.id,
      panoramaId: r.panoramaId,
      productId: r.productId,
      variantId: r.variantId,
      modelId: r.modelId,
      yaw: Number(r.yaw),
      pitch: Number(r.pitch),
      distance: Number(r.distance),
      rotationX: Number(r.rotationX),
      rotationY: Number(r.rotationY),
      rotationZ: Number(r.rotationZ),
      scale: Number(r.scale),
      product: pById.get(r.productId)
        ? { id: r.productId, name: pById.get(r.productId)!.name, slug: pById.get(r.productId)!.slug }
        : null,
      model: (r.modelId !== null ? byId.get(r.modelId) : undefined) ?? prim.get(r.productId) ?? null,
    }));
  }

  // ---------------------------------------------------------------- nghiệp vụ

  private async panorama(id: number) {
    const p = await this.prisma.spacePanorama.findUnique({
      where: { id },
      select: { id: true, spaceId: true },
    });
    if (!p) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Ảnh 360° không tồn tại.');
    return p;
  }

  private async placement(panoramaId: number, placementId: number) {
    const r = await this.prisma.spaceProductPlacement.findFirst({ where: { id: placementId, panoramaId } });
    if (!r) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Vị trí đặt sản phẩm không tồn tại.');
    return r;
  }

  /** Số trong khoảng; không gửi ⇒ dùng `fallback` (undefined = bắt buộc) */
  private numField(
    b: Record<string, unknown>,
    key: string,
    errs: FieldErrors,
    label: string,
    opt: { min?: number; max?: number; gt?: number; fallback?: number },
  ): number {
    if (b[key] === undefined || b[key] === null || b[key] === '') {
      if (opt.fallback !== undefined) return opt.fallback;
      errs.add(key, `${label} là bắt buộc.`);
      return 0;
    }
    const n = num(b[key]);
    if (!Number.isFinite(n)) errs.add(key, `${label} phải là số.`);
    else if (opt.gt !== undefined && n <= opt.gt) errs.add(key, `${label} phải lớn hơn ${opt.gt}.`);
    else if (opt.min !== undefined && n < opt.min) errs.add(key, `${label} không nhỏ hơn ${opt.min}.`);
    else if (opt.max !== undefined && n > opt.max) errs.add(key, `${label} không lớn hơn ${opt.max}.`);
    return n;
  }

  /** Đọc và kiểm tra các trường vị trí; `cur` có ⇒ chỉ cần gửi trường muốn đổi (PATCH) */
  private fields(b: Record<string, unknown>, errs: FieldErrors, cur?: Record<string, unknown>) {
    const pick = (k: string) => (b[k] !== undefined ? b : { ...b, [k]: cur?.[k] });
    const f = (key: string, label: string, opt: Parameters<PanoramasService['numField']>[4]) =>
      this.numField(pick(key), key, errs, label, opt);
    return {
      yaw: f('yaw', 'Yaw', { min: -180, max: 180 }),
      pitch: f('pitch', 'Pitch', { min: -90, max: 90 }),
      distance: f('distance', 'Khoảng cách', { gt: 0, max: 49 }),
      rotationX: f('rotationX', 'Xoay X', { min: -360, max: 360, fallback: 0 }),
      rotationY: f('rotationY', 'Xoay Y', { min: -360, max: 360, fallback: 0 }),
      rotationZ: f('rotationZ', 'Xoay Z', { min: -360, max: 360, fallback: 0 }),
      scale: f('scale', 'Tỉ lệ', { gt: 0, max: 20, fallback: 1 }),
    };
  }

  /** Biến thể phải thuộc sản phẩm; mô hình (nếu chọn) phải thuộc sản phẩm và `ready`; không chọn ⇒ mô hình chính */
  private async resolveRefs(
    productId: number,
    variantId: number | null,
    modelId: number | null,
    errs: FieldErrors,
  ): Promise<number | null> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) {
      errs.add('productId', 'Sản phẩm không tồn tại.');
      return null;
    }
    if (variantId !== null) {
      const v = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
      if (!v) errs.add('variantId', 'Biến thể không thuộc sản phẩm này.');
    }
    if (modelId !== null) {
      const m = await this.prisma.product3DModel.findFirst({ where: { id: modelId, productId } });
      if (!m) errs.add('modelId', 'Mô hình không thuộc sản phẩm này.');
      else if (m.status !== 'ready') errs.add('modelId', 'Mô hình chưa sẵn sàng (chưa xử lý xong).');
      return m?.status === 'ready' ? m.id : null;
    }
    const primary = await this.prisma.product3DModel.findFirst({
      where: { productId, isPrimary: true, status: 'ready' },
    });
    if (!primary) errs.add('modelId', 'Sản phẩm chưa có mô hình 3D sẵn sàng để đặt vào ảnh.');
    return primary?.id ?? null;
  }

  async list(panoramaId: number) {
    await this.panorama(panoramaId);
    const rows = await this.prisma.spaceProductPlacement.findMany({
      where: { panoramaId },
      orderBy: { id: 'asc' },
    });
    return this.placementViews(rows);
  }

  /** POST /admin/panoramas/:id/placements ⇒ 201 */
  async create(adminId: number, panoramaId: number, raw: unknown) {
    const pano = await this.panorama(panoramaId);
    const b = asBody(raw);
    const errs = new FieldErrors();
    const productId = toId(b.productId);
    if (!productId) errs.add('productId', 'Thiếu sản phẩm.');
    const variantId =
      b.variantId === undefined || b.variantId === null || b.variantId === '' ? null : toId(b.variantId);
    if (variantId === 0) errs.add('variantId', 'Biến thể không hợp lệ.');
    const modelIdIn =
      b.modelId === undefined || b.modelId === null || b.modelId === '' ? null : toId(b.modelId);
    if (modelIdIn === 0) errs.add('modelId', 'Mô hình không hợp lệ.');
    const pos = this.fields(b, errs);
    const modelId = productId ? await this.resolveRefs(productId, variantId, modelIdIn, errs) : null;
    errs.throwIfAny();

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.spaceProductPlacement.create({
        data: { panoramaId, productId, variantId, modelId, ...pos },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'placement.create',
          targetType: 'spaceplacement',
          targetId: created.id,
          changes: { spaceId: pano.spaceId, panoramaId, productId, variantId, modelId, ...pos },
        },
        tx,
      );
      return created;
    });
    return (await this.placementViews([row]))[0];
  }

  /** PATCH /admin/panoramas/:id/placements/:placementId – chỉ gửi trường muốn đổi */
  async update(adminId: number, panoramaId: number, placementId: number, raw: unknown) {
    const pano = await this.panorama(panoramaId);
    const cur = await this.placement(panoramaId, placementId);
    const b = asBody(raw);
    const errs = new FieldErrors();
    const productId = b.productId !== undefined ? toId(b.productId) : cur.productId;
    if (!productId) errs.add('productId', 'Sản phẩm không hợp lệ.');
    const productChanged = productId !== cur.productId;
    // đổi sản phẩm mà không nói rõ biến thể/mô hình ⇒ bỏ biến thể cũ, dùng mô hình chính của sản phẩm mới
    const variantRaw = b.variantId !== undefined ? b.variantId : productChanged ? null : cur.variantId;
    const variantId = variantRaw === null || variantRaw === '' ? null : toId(variantRaw);
    if (variantId === 0) errs.add('variantId', 'Biến thể không hợp lệ.');
    const modelRaw = b.modelId !== undefined ? b.modelId : productChanged ? null : cur.modelId;
    const modelIdIn = modelRaw === null || modelRaw === '' ? null : toId(modelRaw);
    if (modelIdIn === 0) errs.add('modelId', 'Mô hình không hợp lệ.');
    const pos = this.fields(b, errs, {
      yaw: Number(cur.yaw),
      pitch: Number(cur.pitch),
      distance: Number(cur.distance),
      rotationX: Number(cur.rotationX),
      rotationY: Number(cur.rotationY),
      rotationZ: Number(cur.rotationZ),
      scale: Number(cur.scale),
    });
    const modelId = productId ? await this.resolveRefs(productId, variantId, modelIdIn, errs) : null;
    errs.throwIfAny();

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.spaceProductPlacement.update({
        where: { id: placementId },
        data: { productId, variantId, modelId, ...pos, updatedAt: new Date() },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'placement.update',
          targetType: 'spaceplacement',
          targetId: placementId,
          changes: { spaceId: pano.spaceId, panoramaId, productId, variantId, modelId, ...pos },
        },
        tx,
      );
      return updated;
    });
    return (await this.placementViews([row]))[0];
  }

  /** DELETE /admin/panoramas/:id/placements/:placementId */
  async remove(adminId: number, panoramaId: number, placementId: number) {
    const pano = await this.panorama(panoramaId);
    const cur = await this.placement(panoramaId, placementId);
    await this.prisma.$transaction(async (tx) => {
      await tx.spaceProductPlacement.delete({ where: { id: placementId } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'placement.delete',
          targetType: 'spaceplacement',
          targetId: placementId,
          changes: { spaceId: pano.spaceId, panoramaId, productId: cur.productId },
        },
        tx,
      );
    });
    return null;
  }
}
