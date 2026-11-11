// UC-ADM-14 – Vật liệu theo biến thể của mô hình 3D (bảng model_material_variants): gắn cấu hình vật liệu (màu, độ nhám…) cho từng
// biến thể trên CÙNG một mô hình để khách đổi màu mà không cần tải mô hình mới (UC-3D-03, áp dụng ở client).
// Quy tắc (DATABASE_SCHEMA §9.2 #4): biến thể phải thuộc CÙNG sản phẩm với mô hình (Service kiểm, DB không ràng buộc được);
// UNIQUE (model_id, variant_id) ⇒ PUT là "tạo hoặc thay thế", gọi lại không tạo bản trùng.
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { readGlb } from '../jobs/model-processing/glb-tools';
import { ProductsService } from '../products/products.service';

export interface MaterialConfig {
  baseColor?: string;
  roughness?: number;
  metalness?: number;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const KEYS = ['baseColor', 'roughness', 'metalness'] as const;

/** Kiểm tra config: baseColor "#RRGGBB", roughness/metalness trong [0,1]; khóa lạ bị từ chối; phải có ít nhất một khóa */
export function parseMaterialConfig(raw: unknown, errs: FieldErrors): MaterialConfig {
  const out: MaterialConfig = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errs.add('config', 'Cấu hình vật liệu phải là một đối tượng.');
    return out;
  }
  const c = raw as Record<string, unknown>;
  const unknown = Object.keys(c).filter((k) => !(KEYS as readonly string[]).includes(k));
  if (unknown.length)
    errs.add('config', `Khóa không hỗ trợ: ${unknown.join(', ')}. Chỉ nhận ${KEYS.join(', ')}.`);
  if (c.baseColor !== undefined) {
    if (typeof c.baseColor === 'string' && HEX.test(c.baseColor)) out.baseColor = c.baseColor.toUpperCase();
    else errs.add('config', 'baseColor phải có dạng #RRGGBB.');
  }
  for (const k of ['roughness', 'metalness'] as const) {
    if (c[k] === undefined) continue;
    if (typeof c[k] === 'number' && (c[k] as number) >= 0 && (c[k] as number) <= 1) out[k] = c[k] as number;
    else errs.add('config', `${k} phải là số từ 0 đến 1.`);
  }
  if (!Object.keys(c).length) errs.add('config', 'Cấu hình vật liệu không được để trống.');
  return out;
}

@Injectable()
export class ModelMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async model(modelId: number) {
    const m = await this.prisma.product3DModel.findUnique({ where: { id: modelId } });
    if (!m) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    return m;
  }

  private view(r: {
    id: number;
    modelId: number;
    variantId: number;
    materialName: string;
    config: unknown;
    updatedAt: Date;
  }) {
    return {
      id: r.id,
      modelId: r.modelId,
      variantId: r.variantId,
      materialName: r.materialName,
      config: r.config as MaterialConfig,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  /** GET /admin/models/:id/material-variants */
  async list(modelId: number) {
    await this.model(modelId);
    const rows = await this.prisma.modelMaterialVariant.findMany({
      where: { modelId },
      orderBy: { variantId: 'asc' },
    });
    return rows.map((r) => this.view(r));
  }

  /**
   * GET /admin/models/:id/materials – tên các vật liệu CÓ TRONG tệp GLB (đọc LOD medium, không có thì tệp GLB bất kỳ) để admin chọn
   * `materialName`. Mô hình chưa xử lý xong (chưa có tệp GLB) ⇒ danh sách rỗng.
   */
  async materialNames(modelId: number): Promise<{ names: string[] }> {
    await this.model(modelId);
    const files = await this.prisma.modelFile.findMany({
      where: { modelId, format: 'glb' },
      include: { media: true },
    });
    const f = files.find((x) => x.lod === 'medium') ?? files[0];
    if (!f) return { names: [] };
    let bytes: Buffer;
    try {
      bytes = await this.storage.download(f.media.filePath, 'public');
    } catch {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không đọc được tệp GLB của mô hình trong kho lưu trữ.',
      );
    }
    const doc = await readGlb(bytes);
    const names = doc
      .getRoot()
      .listMaterials()
      .map((m) => m.getName())
      .filter((n) => n.trim().length > 0);
    return { names: [...new Set(names)] };
  }

  /** PUT /admin/models/:id/material-variants/:variantId { materialName, config } ⇒ 200 (tạo hoặc thay thế) */
  async set(adminId: number, modelId: number, variantId: number, raw: unknown) {
    const model = await this.model(modelId);
    const b = asBody(raw);
    const errs = new FieldErrors();
    const materialName = str(b.materialName).trim();
    if (!materialName || materialName.length > 150)
      errs.add('materialName', 'Tên vật liệu từ 1 đến 150 ký tự.');
    const config = parseMaterialConfig(b.config, errs);
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== model.productId)
      errs.add('variantId', 'Biến thể không thuộc sản phẩm của mô hình này.');
    errs.throwIfAny();

    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.modelMaterialVariant.findUnique({
        where: { modelId_variantId: { modelId, variantId } },
      });
      const saved = await tx.modelMaterialVariant.upsert({
        where: { modelId_variantId: { modelId, variantId } },
        update: { materialName, config: config as object },
        create: { modelId, variantId, materialName, config: config as object },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: before ? 'model.material_update' : 'model.material_create',
          targetType: 'product3dmodel',
          targetId: modelId,
          changes: { variantId, materialName, config: config as object },
        },
        tx,
      );
      return saved;
    });
    await this.products.invalidate(); // chi tiết sản phẩm (cache) có materialVariants
    return this.view(row);
  }

  /** DELETE /admin/models/:id/material-variants/:variantId */
  async remove(adminId: number, modelId: number, variantId: number) {
    await this.model(modelId);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.modelMaterialVariant.deleteMany({ where: { modelId, variantId } });
      if (r.count === 0)
        throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Biến thể này chưa có cấu hình vật liệu.');
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.material_delete',
          targetType: 'product3dmodel',
          targetId: modelId,
          changes: { variantId },
        },
        tx,
      );
    });
    await this.products.invalidate();
    return null;
  }
}
