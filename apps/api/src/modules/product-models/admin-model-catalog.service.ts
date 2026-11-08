// UC-ADM-13/14 – Quản trị mô hình 3D: danh sách, tải lên GLB/USDZ, xử lý nền, xử lý lại, mô hình chính, xóa.
// Tải lên chỉ KIỂM TRA + LƯU TỆP GỐC (bucket private) rồi đặt `processing` và đẩy job `model-processing`; trả 202.
// Job (ModelProcessingService) mới sinh LOD, tạo media + model_files và đặt `ready` (D-P10). Trigger DB tự cập nhật has_3d_model/has_ar.
//
// Hai cách tải lên (đều bắt buộc có nội dung tệp):
//  • POST /admin/models (JSON): { productId, fileName, format, fileData (data-URL base64), ... }.
//  • POST /admin/models/upload (multipart, trường `file`): đường tải thật cho FE.
// Mỗi dòng của danh sách là một TỆP (model_files); mô hình chưa có tệp (đang xử lý / lỗi) hiện thành một dòng riêng (fileId = null).
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type ModelProcessingAccepted, type PresignedUpload } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { ProductModelsService } from './product-models.service';
import { ProductsService } from '../products/products.service';
import {
  MODEL_MAX_BYTES,
  ONLY_GLB_MESSAGE,
  validateModelFile,
  type ModelFormat,
} from './model-file-validator';

const MODEL_INCLUDE = {
  product: {
    include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } },
  },
  modelFiles: { include: { media: true } },
  posterMedia: true,
} satisfies Prisma.Product3DModelInclude;
type ModelRow = Prisma.Product3DModelGetPayload<{ include: typeof MODEL_INCLUDE }>;

/** Thông tin lần tải lên / lỗi gần nhất của mô hình, đọc từ activity_logs (không thêm cột) */
interface ModelNotes {
  upload?: { fileName?: string; format?: ModelFormat; sizeBytes?: number; at: Date };
  failure?: string;
}

/** Kết quả POST /admin/models/presign: PresignedUpload kèm id mô hình đích để confirm */
export type PresignedModelUpload = PresignedUpload & { modelId: number };

export interface UploadInput {
  productId: unknown;
  variantId?: unknown;
  fileName: string;
  format?: string;
  allowAr?: unknown;
  scale?: unknown;
  unit?: unknown;
  placement?: unknown;
  /** true ⇒ tạo mô hình MỚI cho sản phẩm thay vì thay tệp của mô hình chính hiện có */
  createNew?: unknown;
  /** nội dung tệp (multipart hoặc data-URL đã giải mã) */
  bytes?: Buffer;
  mimeType?: string;
}

const isTrue = (v: unknown) => v === true || v === 'true' || v === '1';

@Injectable()
export class AdminModelCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
    private readonly jobs: JobsService,
    private readonly models: ProductModelsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private row(m: ModelRow, f: ModelRow['modelFiles'][number] | null, notes: ModelNotes) {
    const p = m.product;
    const { modelFiles, posterMedia, product: _p, ...mbase } = m;
    void _p;
    const files = modelFiles.map((x) => ({
      id: x.id,
      modelId: x.modelId,
      format: x.format,
      lod: x.lod,
      mediaId: x.mediaId,
      url: this.views.url(x.media.filePath) ?? '',
      fileName: x.media.fileName,
      fileSize: x.media.fileSize,
      polygonCount: x.polygonCount,
      textureResolution: x.textureResolution,
      isCompressed: x.isCompressed,
      checksum: x.checksum,
    }));
    const glb =
      files.find((x) => x.format === 'glb' && x.lod === 'medium') ?? files.find((x) => x.format === 'glb');
    const fileName = f?.media.fileName ?? notes.upload?.fileName ?? '(chưa có tệp)';
    const bytes = f?.media.fileSize ?? notes.upload?.sizeBytes ?? 0;
    return {
      ...JSON.parse(JSON.stringify(mbase)),
      files,
      // id dòng = id tệp; mô hình chưa có tệp dùng -modelId (xóa qua DELETE /admin/models/model/:modelId)
      modelId: m.id,
      id: f ? f.id : -m.id,
      fileId: f ? f.id : null,
      glbUrl: glb?.url ?? null,
      posterUrl: this.views.url(posterMedia?.filePath),
      productName: p.name,
      productThumbnailUrl: this.views.url(p.productImages[0]?.media.filePath),
      format: f?.format ?? notes.upload?.format ?? 'glb',
      lod: f?.lod ?? null,
      fileName,
      sizeMB: Math.round((bytes / 1024 / 1024) * 10) / 10,
      uploadedAt: (f?.createdAt ?? notes.upload?.at ?? m.updatedAt).toISOString(),
      failureReason: m.status === 'failed' ? (notes.failure ?? 'Xử lý mô hình thất bại.') : null,
    };
  }

  /** Lần tải lên và lý do lỗi gần nhất của các mô hình (một truy vấn) */
  private async notesFor(models: ModelRow[]): Promise<Map<number, ModelNotes>> {
    const need = models.filter((m) => m.status !== 'ready' || m.modelFiles.length === 0).map((m) => m.id);
    const out = new Map<number, ModelNotes>();
    if (!need.length) return out;
    const logs = await this.prisma.activityLog.findMany({
      where: {
        targetType: 'product3dmodel',
        targetId: { in: need },
        action: { in: ['model.upload', 'model.processing_failed'] },
      },
      orderBy: { id: 'desc' },
    });
    for (const l of logs) {
      const n = out.get(l.targetId!) ?? {};
      const c = (l.changes ?? {}) as Record<string, unknown>;
      if (l.action === 'model.upload' && !n.upload)
        n.upload = {
          fileName: c.fileName as string | undefined,
          format: c.format as ModelFormat | undefined,
          sizeBytes: c.sizeBytes as number | undefined,
          at: l.createdAt,
        };
      if (l.action === 'model.processing_failed' && n.failure === undefined)
        n.failure = String(c.reason ?? '');
      out.set(l.targetId!, n);
    }
    return out;
  }

  async list(q: RawQuery) {
    const productId = qNum(q, 'productId', 0);
    const format = qStr(q, 'format');
    const search = foldVi(qStr(q, 'q'));
    const models = await this.prisma.product3DModel.findMany({
      where: productId ? { productId } : {},
      include: MODEL_INCLUDE,
    });
    const notes = await this.notesFor(models);
    let list = models.flatMap((m) => {
      const n = notes.get(m.id) ?? {};
      return m.modelFiles.length ? m.modelFiles.map((f) => this.row(m, f, n)) : [this.row(m, null, n)];
    });
    if (format) list = list.filter((r) => r.format === format);
    if (search) list = list.filter((r) => foldVi(`${r.fileName} ${r.productName}`).includes(search));
    const [field, dir] = (qStr(q, 'sort') || 'uploadedAt:desc').split(':');
    const mul = dir === 'asc' ? 1 : -1;
    const key = (r: (typeof list)[number]): string | number =>
      field === 'sizeMB' ? r.sizeMB : field === 'fileName' ? r.fileName : r.uploadedAt;
    list.sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1) * mul);
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  /** UC-ADM-13: kiểm tra, lưu tệp gốc (private), đặt `processing`, đẩy job. Trả 202 { modelId, jobId, status } */
  async upload(adminId: number, input: UploadInput): Promise<ModelProcessingAccepted> {
    const target = await this.resolveTarget(input, !input.bytes?.length);
    const { product } = target;

    const bytes = input.bytes!;
    let check;
    try {
      check = validateModelFile({
        fileName: input.fileName,
        sizeBytes: bytes.length,
        declaredFormat: input.format,
        mimeType: input.mimeType,
        bytes,
      });
    } catch (e) {
      // định dạng khác GLB (USDZ...) ⇒ 415 nguyên văn (D-P11)
      if (e instanceof AppException && e.message === ONLY_GLB_MESSAGE) throw e;
      if (e instanceof AppException && e.code !== ErrorCode.PAYLOAD_TOO_LARGE)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          [e.code === ErrorCode.UNSUPPORTED_MEDIA_TYPE ? 'format' : 'file']: [e.message],
        });
      if (e instanceof AppException)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', { file: [e.message] });
      throw e;
    }
    if (bytes.length > MODEL_MAX_BYTES)
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, 'Tệp phải nhỏ hơn hoặc bằng 100MB.');

    // Tệp gốc vào bucket PRIVATE (tên do server sinh ⇒ không thể path traversal); job tải về từ đây
    const sourceKey = `models/incoming/p${product.id}/${randomUUID()}.${check.ext}`;
    await this.storage.upload({
      key: sourceKey,
      body: bytes,
      contentType: check.mime,
      visibility: 'private',
    });

    let modelId: number;
    try {
      modelId = await this.prisma.$transaction(async (tx) => {
        const model = await this.resolveModel(tx, target, input, 'processing');
        await this.activity.log(
          {
            actorId: adminId,
            action: 'model.upload',
            targetType: 'product3dmodel',
            targetId: model.id,
            changes: {
              fileName: check.fileName,
              format: check.format,
              lod: 'high',
              sizeBytes: bytes.length,
              sourceKey,
            },
          },
          tx,
        );
        return model.id;
      });
    } catch (e) {
      await this.storage.delete(sourceKey, 'private').catch(() => undefined);
      throw e;
    }

    const jobId = await this.enqueue(modelId, {
      format: check.format,
      lod: 'high',
      sourceKey,
      fileName: check.fileName,
      uploadedBy: adminId,
    });
    await this.products.invalidate();
    return { modelId, jobId, status: 'processing' };
  }

  /** Kiểm tra sản phẩm, biến thể, tỉ lệ, đơn vị, vị trí đặt (dùng chung cho tải multipart/JSON và presigned) */
  private async resolveTarget(input: UploadInput, fileMissing = false) {
    const errs = new FieldErrors();
    const product = await this.prisma.product.findFirst({
      where: { id: toId(input.productId), deletedAt: null },
      include: { productImages: { where: { isPrimary: true }, take: 1 } },
    });
    if (!product) errs.add('productId', 'Vui lòng chọn sản phẩm liên kết.');
    let variantId: number | null = null;
    if (input.variantId) {
      variantId = toId(input.variantId);
      if (
        !product ||
        !(await this.prisma.productVariant.findFirst({ where: { id: variantId, productId: product.id } }))
      )
        errs.add('variantId', 'Biến thể không thuộc sản phẩm.');
    }
    const scale = input.scale === undefined || input.scale === '' ? 1 : Number(input.scale);
    if (!(scale > 0 && scale <= 100)) errs.add('scale', 'Tỉ lệ phải lớn hơn 0 và không quá 100.');
    const unit = input.unit ? str(input.unit) : 'mm';
    if (!['mm', 'cm', 'm'].includes(unit)) errs.add('unit', 'Đơn vị phải là mm, cm hoặc m.');
    const placement = input.placement ? str(input.placement) : 'floor';
    if (!['floor', 'wall', 'table'].includes(placement)) errs.add('placement', 'Vị trí đặt không hợp lệ.');
    if (fileMissing) errs.add('file', 'Vui lòng chọn tệp mô hình để tải lên.');
    errs.throwIfAny();
    return { product: product!, variantId, scale, unit, placement };
  }

  /**
   * Mô hình đích của lần tải: mô hình chính hiện có của sản phẩm (hoặc mô hình mới khi createNew / chưa có mô hình chính).
   * `status` chỉ áp cho mô hình MỚI tạo; mô hình đã có chỉ đổi sang `status` khi truyền `touchStatus`.
   */
  private async resolveModel(
    tx: Prisma.TransactionClient,
    t: Awaited<ReturnType<AdminModelCatalogService['resolveTarget']>>,
    input: UploadInput,
    status: 'uploading' | 'processing',
    touchStatus = true,
  ) {
    const { product, variantId, scale, unit, placement } = t;
    let model = isTrue(input.createNew)
      ? null
      : await tx.product3DModel.findFirst({ where: { productId: product.id, isPrimary: true } });
    if (!model) {
      const hasPrimary = await tx.product3DModel.count({ where: { productId: product.id, isPrimary: true } });
      const dims = await tx.productVariant.findFirst({
        where: { productId: product.id, lengthCm: { not: null } },
        orderBy: { id: 'asc' },
      });
      return tx.product3DModel.create({
        data: {
          productId: product.id,
          variantId,
          lengthMm: dims?.lengthCm ? Math.round(Number(dims.lengthCm) * 10) : 1000,
          widthMm: dims?.widthCm ? Math.round(Number(dims.widthCm) * 10) : 800,
          heightMm: dims?.heightCm ? Math.round(Number(dims.heightCm) * 10) : 800,
          placement: placement as never,
          allowScaling: true,
          viewerConfig: { autoRotate: true, exposure: 1, scale, unit },
          posterMediaId: product.productImages[0]?.mediaId ?? null,
          status,
          isPrimary: hasPrimary === 0,
        },
      });
    }
    model = await tx.product3DModel.update({
      where: { id: model.id },
      data: {
        ...(touchStatus ? { status } : {}),
        allowScaling: true,
        placement: placement as never,
        ...(variantId ? { variantId } : {}),
        viewerConfig: { ...((model.viewerConfig ?? {}) as object), scale, unit },
      },
    });
    return model;
  }

  /**
   * Driver MinIO/S3 (UC-ADM-13 bước 4): tạo/chọn mô hình đích rồi cấp URL để trình duyệt PUT thẳng tệp GLB lên bucket PRIVATE
   * (models/incoming/<modelId>/…). Mô hình mới ở trạng thái `uploading`; mô hình đang `ready` giữ nguyên cho tới khi
   * confirm (POST /admin/models/:id/files/confirm ⇒ 202, `processing`, job model-processing).
   */
  async presignUpload(
    adminId: number,
    input: UploadInput & { size?: unknown },
  ): Promise<PresignedModelUpload> {
    const t = await this.resolveTarget(input);
    const size = Number(input.size);
    if (!Number.isInteger(size) || size < 1)
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
        size: ['Dung lượng tệp không hợp lệ.'],
      });
    // dùng lại bộ kiểm tra tệp (đuôi, GLB-only, ≤ 100MB) không cần nội dung
    try {
      validateModelFile({ fileName: input.fileName, sizeBytes: size, declaredFormat: input.format });
    } catch (e) {
      if (e instanceof AppException && e.message === ONLY_GLB_MESSAGE) throw e;
      if (e instanceof AppException && e.code === ErrorCode.PAYLOAD_TOO_LARGE) throw e;
      if (e instanceof AppException)
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', { file: [e.message] });
      throw e;
    }
    const model = await this.prisma.$transaction((tx) => this.resolveModel(tx, t, input, 'uploading', false));
    const presign = await this.models.presignFile(model.id, {
      format: 'glb',
      fileName: input.fileName,
      size,
    });
    return { modelId: model.id, ...presign };
  }

  /** Chuẩn hóa body JSON của POST /admin/models/presign */
  presignInput(raw: unknown): UploadInput & { size?: unknown } {
    const b = asBody(raw);
    return {
      ...b,
      productId: b.productId,
      fileName: str(b.fileName),
      format: b.format ? str(b.format) : undefined,
      size: b.size,
    };
  }

  /** Đẩy job; nếu Redis lỗi thì không để mô hình kẹt `processing` mãi */
  private async enqueue(
    modelId: number,
    job: {
      format: ModelFormat;
      lod: 'high' | 'medium' | 'low';
      sourceKey: string;
      fileName: string;
      uploadedBy: number;
    },
  ) {
    try {
      return await this.jobs.enqueueModel({ modelId, ...job });
    } catch (e) {
      await this.prisma.product3DModel.updateMany({ where: { id: modelId }, data: { status: 'failed' } });
      throw e;
    }
  }

  /** POST /admin/models (JSON): bắt buộc kèm fileData = data-URL base64 */
  uploadJson(adminId: number, raw: unknown) {
    const b = asBody(raw);
    let bytes: Buffer | undefined;
    let mimeType: string | undefined;
    if (b.fileData) {
      const m = /^data:([\w/+.-]*);base64,(.+)$/s.exec(str(b.fileData));
      if (!m) new FieldErrors().add('file', 'Nội dung tệp không hợp lệ.').throwIfAny();
      mimeType = m![1] || undefined;
      bytes = Buffer.from(m![2], 'base64');
    } else if (Number(b.sizeMB) > MODEL_MAX_BYTES / 1024 / 1024) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
        file: ['Tệp phải nhỏ hơn hoặc bằng 100MB.'],
      });
    }
    return this.upload(adminId, {
      ...b,
      fileName: str(b.fileName),
      format: b.format ? str(b.format) : undefined,
      bytes,
      mimeType,
      productId: b.productId,
    });
  }

  /** UC-ADM-13: xử lý lại mô hình `failed` từ tệp gốc đã lưu (failed → processing) */
  async reprocess(adminId: number, modelId: number): Promise<ModelProcessingAccepted> {
    const model = await this.prisma.product3DModel.findUnique({ where: { id: modelId } });
    if (!model) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    if (model.status !== 'failed')
      throw new AppException(ErrorCode.INVALID_STATE, 'Chỉ xử lý lại được mô hình đang ở trạng thái lỗi.');

    // Tệp gốc mới nhất của từng định dạng, lấy từ nhật ký tải lên
    const logs = await this.prisma.activityLog.findMany({
      where: { targetType: 'product3dmodel', targetId: modelId, action: 'model.upload' },
      orderBy: { id: 'desc' },
    });
    const sources = new Map<
      string,
      { sourceKey: string; fileName: string; lod: 'high' | 'medium' | 'low' }
    >();
    for (const l of logs) {
      const c = (l.changes ?? {}) as {
        sourceKey?: string;
        fileName?: string;
        format?: string;
        lod?: 'high' | 'medium' | 'low';
      };
      if (!c.sourceKey || !c.format || sources.has(c.format)) continue;
      if (await this.storage.head(c.sourceKey, 'private'))
        sources.set(c.format, {
          sourceKey: c.sourceKey,
          fileName: c.fileName ?? 'model',
          lod: c.lod ?? 'high',
        });
    }
    if (!sources.size)
      throw new AppException(
        ErrorCode.INVALID_STATE,
        'Không còn tệp gốc để xử lý lại, hãy tải mô hình lên lại.',
      );

    await this.prisma.$transaction(async (tx) => {
      const r = await tx.product3DModel.updateMany({
        where: { id: modelId, status: 'failed' },
        data: { status: 'processing' },
      });
      if (r.count === 0)
        throw new AppException(ErrorCode.INVALID_STATE, 'Chỉ xử lý lại được mô hình đang ở trạng thái lỗi.');
      await this.activity.log(
        { actorId: adminId, action: 'model.reprocess', targetType: 'product3dmodel', targetId: modelId },
        tx,
      );
    });
    let first = '';
    for (const [format, s] of sources) {
      const id = await this.enqueue(modelId, { format: format as ModelFormat, ...s, uploadedBy: adminId });
      first ||= id;
    }
    return { modelId, jobId: first, status: 'processing' };
  }

  /** UC-ADM-13: đặt mô hình chính của sản phẩm (bỏ cờ cũ rồi đặt cờ mới, cùng transaction) */
  async setPrimary(adminId: number, modelId: number) {
    const model = await this.prisma.product3DModel.findUnique({ where: { id: modelId } });
    if (!model) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    if (model.status !== 'ready')
      throw new AppException(
        ErrorCode.INVALID_STATE,
        'Chỉ đặt làm mô hình chính khi mô hình đã xử lý xong (ready).',
      );
    if (!model.isPrimary) {
      await this.prisma.$transaction(async (tx) => {
        await tx.product3DModel.updateMany({
          where: { productId: model.productId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.product3DModel.update({ where: { id: modelId }, data: { isPrimary: true } });
        await this.activity.log(
          {
            actorId: adminId,
            action: 'model.set_primary',
            targetType: 'product3dmodel',
            targetId: modelId,
            changes: { productId: model.productId },
          },
          tx,
        );
      });
      await this.products.invalidate();
    }
    return { modelId, productId: model.productId, isPrimary: true };
  }

  /** Xóa một tệp; tệp cuối cùng ⇒ xóa luôn mô hình */
  async remove(adminId: number, fileId: number) {
    const f = await this.prisma.modelFile.findUnique({ where: { id: fileId }, include: { media: true } });
    if (!f) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    const productId = (await this.prisma.product3DModel.findUniqueOrThrow({ where: { id: f.modelId } }))
      .productId;
    await this.prisma.$transaction(async (tx) => {
      await tx.modelFile.delete({ where: { id: fileId } });
      // tệp cuối cùng ⇒ xóa luôn mô hình (trigger đặt has_3d_model/has_ar = false)
      if (!(await tx.modelFile.count({ where: { modelId: f.modelId } }))) {
        await tx.modelMaterialVariant.deleteMany({ where: { modelId: f.modelId } });
        await tx.product3DModel.delete({ where: { id: f.modelId } });
      }
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.delete',
          targetType: 'product3dmodel',
          targetId: f.modelId,
          changes: { fileName: f.media.fileName, productId },
        },
        tx,
      );
    });
    await this.dropMediaIfUnused(f.mediaId, f.media.filePath);
    await this.products.invalidate();
    return null;
  }

  /** Xóa cả mô hình (kể cả mô hình chưa có tệp: đang xử lý hoặc lỗi) */
  async removeModel(adminId: number, modelId: number) {
    const model = await this.prisma.product3DModel.findUnique({
      where: { id: modelId },
      include: { modelFiles: { include: { media: true } } },
    });
    if (!model) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    await this.prisma.$transaction(async (tx) => {
      await tx.modelFile.deleteMany({ where: { modelId } });
      await tx.modelMaterialVariant.deleteMany({ where: { modelId } });
      await tx.product3DModel.delete({ where: { id: modelId } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.delete',
          targetType: 'product3dmodel',
          targetId: modelId,
          changes: { productId: model.productId },
        },
        tx,
      );
    });
    for (const f of model.modelFiles) await this.dropMediaIfUnused(f.mediaId, f.media.filePath);
    await this.products.invalidate();
    return null;
  }

  /** Xóa tệp vật lý + bản ghi media nếu không còn nơi nào dùng */
  private async dropMediaIfUnused(mediaId: number, filePath: string) {
    const used =
      (await this.prisma.modelFile.count({ where: { mediaId } })) +
      (await this.prisma.product3DModel.count({ where: { posterMediaId: mediaId } }));
    if (!used && filePath.startsWith('models/')) {
      await this.storage.delete(filePath, 'public').catch(() => undefined);
      await this.prisma.media.delete({ where: { id: mediaId } }).catch(() => undefined);
    }
  }
}
