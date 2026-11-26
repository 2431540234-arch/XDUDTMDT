// UC-ADM-31/32 – Duyệt mô hình 3D: xem thử bản chờ duyệt (tệp private, chỉ admin), duyệt / bỏ / chuẩn hóa lại.
// Chỉ bước DUYỆT mới chép tệp ra bucket public và tạo media + model_files; trước đó khách không có cách nào lấy được tệp.
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type ModelProcessingAccepted } from '@aurelia-living/shared-types';
import sharp from 'sharp';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { asBody } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import type { LodName } from '../jobs/jobs.constants';
import { JobsService } from '../jobs/jobs.service';
import {
  actionBlocker,
  defaultVariantKey,
  readPipeline,
  withPipeline,
  type ModelAction,
  type ModelPipeline,
  type PipelineVariant,
  type VariantKey,
} from '../jobs/model-processing/model-pipeline';
import { pendingKeysOf } from '../jobs/model-processing/model-processing.service';
import { ProductsService } from '../products/products.service';

const LODS: LodName[] = ['high', 'medium', 'low'];
const POSTER_MAX_BYTES = 4 * 1024 * 1024;

const stemOf = (fileName: string) =>
  fileName
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80) || 'model';

@Injectable()
export class ModelReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
    private readonly jobs: JobsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async load(modelId: number) {
    const model = await this.prisma.product3DModel.findUnique({
      where: { id: modelId },
      include: {
        product: true,
        modelFiles: { include: { media: true } },
        posterMedia: true,
      },
    });
    if (!model) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không tồn tại.');
    return { model, pipeline: readPipeline(model.viewerConfig) };
  }

  private assertAllowed(
    action: ModelAction,
    status: Prisma.Product3DModelGetPayload<object>['status'],
    pipeline: ModelPipeline | null,
  ) {
    const blocker = actionBlocker(action, status, pipeline);
    if (blocker) throw new AppException(ErrorCode.INVALID_STATE, blocker);
  }

  /** Thông tin cho màn duyệt. KHÔNG trả khóa kho: tệp chờ duyệt chỉ lấy được qua `preview` (có xác thực). */
  async detail(modelId: number) {
    const { model, pipeline } = await this.load(modelId);
    const sourceImage = pipeline?.sourceImageMediaId
      ? await this.prisma.media.findUnique({ where: { id: pipeline.sourceImageMediaId } })
      : null;
    const variant = (v: PipelineVariant) => ({
      report: v.report,
      files: Object.fromEntries(
        LODS.map((lod) => {
          const { key: _key, checksum: _checksum, ...rest } = v.files[lod];
          return [lod, rest];
        }),
      ),
    });
    return {
      id: model.id,
      productId: model.productId,
      productName: model.product.name,
      productSlug: model.product.slug,
      status: model.status,
      isPrimary: model.isPrimary,
      lengthMm: model.lengthMm,
      widthMm: model.widthMm,
      heightMm: model.heightMm,
      source: pipeline?.source ?? null,
      stage: pipeline?.stage ?? null,
      createdAt: pipeline?.createdAt ?? model.createdAt.toISOString(),
      fileName: pipeline?.fileName ?? null,
      rawBytes: pipeline?.rawBytes ?? null,
      space: pipeline?.space ?? null,
      colorName: pipeline?.colorName ?? null,
      generatedSeconds: pipeline?.generatedSeconds ?? null,
      sourceImageUrl: this.views.url(sourceImage?.filePath),
      options: pipeline?.options ?? { removeFloor: true, yawDeg: 0 },
      defaultVariant: pipeline?.variants ? defaultVariantKey(pipeline) : null,
      chosenVariant: pipeline?.chosen ?? null,
      normalization: pipeline?.normalization ?? null,
      variants: Object.fromEntries(
        Object.entries(pipeline?.variants ?? {}).map(([k, v]) => [k, variant(v!)]),
      ),
      error: pipeline?.error ?? null,
    };
  }

  /** Tệp GLB của bản chờ duyệt (đọc từ bucket private) */
  async preview(modelId: number, variant?: string, lod?: string): Promise<Buffer> {
    const { model, pipeline } = await this.load(modelId);
    if (model.status !== 'pending_review' || !pipeline?.variants)
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Mô hình không có bản chờ duyệt để xem.');
    const key = (variant || defaultVariantKey(pipeline)) as VariantKey;
    const file = pipeline.variants[key]?.files[(lod || 'medium') as LodName];
    if (!file) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không có phiên bản này.');
    return this.storage.download(file.key, 'private');
  }

  /** Ảnh chờ do trình duyệt admin chụp từ trình xem lúc duyệt; không hợp lệ thì bỏ qua (dùng ảnh khác) */
  private async posterFrom(dataUrl: unknown): Promise<Buffer | null> {
    if (typeof dataUrl !== 'string') return null;
    const m = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return null;
    const bytes = Buffer.from(m[2], 'base64');
    if (!bytes.length || bytes.length > POSTER_MAX_BYTES) return null;
    try {
      return await sharp(bytes)
        .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return null;
    }
  }

  /**
   * Duyệt: chép phiên bản admin chọn ra bucket public, tạo media + model_files, XÓA mô hình đang hiện (không giữ lịch sử),
   * đặt mô hình mới `ready` + mô hình chính. Trigger DB bật has_3d_model.
   */
  async approve(adminId: number, modelId: number, raw: unknown) {
    const body = asBody(raw ?? {});
    const { model, pipeline } = await this.load(modelId);
    this.assertAllowed('approve', model.status, pipeline);
    const p = pipeline!;
    const key = (body.variant ? String(body.variant) : defaultVariantKey(p)) as VariantKey;
    const variant = p.variants?.[key];
    if (!variant) throw new AppException(ErrorCode.BAD_REQUEST, 'Phiên bản được chọn không tồn tại.');

    const stem = stemOf(p.fileName);
    const uploaded: string[] = [];
    const publicFiles: Array<{ lod: LodName; key: string }> = [];
    const poster = await this.posterFrom(body.posterDataUrl);
    let posterKey: string | null = null;
    try {
      for (const lod of LODS) {
        const f = variant.files[lod];
        const target = `models/${model.id}/${stem}-${lod}-${f.checksum.slice(0, 12)}.glb`;
        await this.storage.upload({
          key: target,
          body: await this.storage.download(f.key, 'private'),
          contentType: 'model/gltf-binary',
          visibility: 'public',
        });
        uploaded.push(target);
        publicFiles.push({ lod, key: target });
      }
      if (poster) {
        posterKey = `models/${model.id}/poster-${createHash('sha256').update(poster).digest('hex').slice(0, 12)}.webp`;
        await this.storage.upload({
          key: posterKey,
          body: poster,
          contentType: 'image/webp',
          visibility: 'public',
        });
        uploaded.push(posterKey);
      }

      const fallbackPoster =
        p.sourceImageMediaId ??
        (
          await this.prisma.productImage.findFirst({
            where: { productId: model.productId, isPrimary: true },
          })
        )?.mediaId ??
        null;

      const replaced = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.product3DModel.updateMany({
          where: { id: model.id, status: 'pending_review' },
          data: { updatedAt: new Date() },
        });
        if (!locked.count)
          throw new AppException(ErrorCode.INVALID_STATE, 'Chỉ duyệt được mô hình đang chờ duyệt.');
        // mô hình cũ của sản phẩm (đã sẵn sàng, lỗi, hoặc đang là mô hình chính) bị thay thế
        const old = await tx.product3DModel.findMany({
          where: {
            productId: model.productId,
            id: { not: model.id },
            OR: [{ isPrimary: true }, { status: { in: ['ready', 'failed'] } }],
          },
          include: { modelFiles: { include: { media: true } }, posterMedia: true },
        });
        const oldIds = old.map((o) => o.id);
        if (oldIds.length) {
          await tx.modelFile.deleteMany({ where: { modelId: { in: oldIds } } });
          await tx.modelMaterialVariant.deleteMany({ where: { modelId: { in: oldIds } } });
          // vị trí đặt trong ảnh 360° được giữ: model_id về trống ⇒ tự dùng mô hình chính mới
          await tx.spaceProductPlacement.updateMany({
            where: { modelId: { in: oldIds } },
            data: { modelId: null },
          });
          await tx.product3DModel.deleteMany({ where: { id: { in: oldIds } } });
        }
        const media = async (filePath: string, mimeType: string, fileSize: number) =>
          (
            await tx.media.upsert({
              where: { filePath },
              update: { fileSize, mimeType },
              create: {
                fileName: filePath.split('/').pop()!,
                filePath,
                mimeType,
                fileSize,
                uploadedBy: adminId,
              },
            })
          ).id;
        for (const file of publicFiles) {
          const f = variant.files[file.lod];
          await tx.modelFile.create({
            data: {
              modelId: model.id,
              format: 'glb',
              lod: file.lod,
              mediaId: await media(file.key, 'model/gltf-binary', f.size),
              polygonCount: f.polygonCount,
              textureResolution: f.textureResolution,
              isCompressed: f.isCompressed,
              checksum: f.checksum,
            },
          });
        }
        const posterMediaId = posterKey
          ? await media(posterKey, 'image/webp', poster!.length)
          : fallbackPoster;
        const { variants: _variants, rawKey: _rawKey, error: _error, ...kept } = p;
        const approved: ModelPipeline = {
          ...kept,
          stage: 'approved',
          chosen: key,
          normalization: variant.report,
        };
        await tx.product3DModel.update({
          where: { id: model.id },
          data: {
            status: 'ready',
            isPrimary: true,
            allowScaling: false,
            lengthMm: variant.report.measuredMm.length,
            widthMm: variant.report.measuredMm.width,
            heightMm: variant.report.measuredMm.height,
            posterMediaId,
            viewerConfig: withPipeline(model.viewerConfig, approved) as never,
          },
        });
        await this.activity.log(
          {
            actorId: adminId,
            action: 'model.approve',
            targetType: 'product3dmodel',
            targetId: model.id,
            changes: {
              variant: key,
              source: p.source,
              space: p.space ?? null,
              replacedModelIds: oldIds,
            },
          },
          tx,
        );
        return old;
      });

      for (const o of replaced) {
        for (const f of o.modelFiles) await this.dropMediaIfUnused(f.mediaId, f.media.filePath);
        if (o.posterMedia) await this.dropMediaIfUnused(o.posterMedia.id, o.posterMedia.filePath);
      }
    } catch (e) {
      // giao dịch không thành công: gỡ tệp vừa đưa ra public (trừ khi đã có bản ghi trỏ tới)
      for (const k of uploaded)
        if (!(await this.prisma.media.count({ where: { filePath: k } })))
          await this.storage.delete(k, 'public').catch(() => undefined);
      throw e;
    }
    await this.dropPrivate(p);
    await this.products.invalidate();
    return { modelId: model.id, productId: model.productId, status: 'ready' as const, variant: key };
  }

  /** Bỏ bản chờ duyệt / lỗi: xóa tệp private và bản ghi */
  async reject(adminId: number, modelId: number) {
    const { model, pipeline } = await this.load(modelId);
    this.assertAllowed('reject', model.status, pipeline);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.product3DModel.deleteMany({
        where: { id: modelId, status: model.status },
      });
      if (!r.count)
        throw new AppException(ErrorCode.INVALID_STATE, 'Mô hình vừa đổi trạng thái, hãy tải lại.');
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.reject',
          targetType: 'product3dmodel',
          targetId: modelId,
          changes: { productId: model.productId, source: pipeline?.source ?? null },
        },
        tx,
      );
    });
    await this.dropPrivate(pipeline);
    return null;
  }

  /** Chuẩn hóa lại từ tệp thô đã lưu (đổi góc xoay / bật tắt gỡ sàn). KHÔNG gọi AI nên không tốn lượt GPU. */
  async renormalize(adminId: number, modelId: number, raw: unknown): Promise<ModelProcessingAccepted> {
    const body = asBody(raw ?? {});
    const { model, pipeline } = await this.load(modelId);
    this.assertAllowed('renormalize', model.status, pipeline);
    const p = pipeline!;
    if (!(await this.storage.head(p.rawKey!, 'private')))
      throw new AppException(ErrorCode.INVALID_STATE, 'Không còn tệp gốc, hãy tạo hoặc tải lên lại.');
    const yawDeg = body.yawDeg === undefined ? p.options.yawDeg : Number(body.yawDeg);
    if (!Number.isInteger(yawDeg) || yawDeg % 90 !== 0 || yawDeg < 0 || yawDeg >= 360)
      throw new AppException(ErrorCode.BAD_REQUEST, 'Góc xoay phải là 0, 90, 180 hoặc 270.');
    p.options = {
      yawDeg,
      removeFloor: body.removeFloor === undefined ? p.options.removeFloor : Boolean(body.removeFloor),
    };
    // giữ khóa tệp cũ trong pipeline để job dọn sau khi có bản mới
    p.stage = 'queued';
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.product3DModel.updateMany({
        where: { id: modelId, status: model.status },
        data: { status: 'processing', viewerConfig: withPipeline(model.viewerConfig, p) as never },
      });
      if (!r.count)
        throw new AppException(ErrorCode.INVALID_STATE, 'Mô hình vừa đổi trạng thái, hãy tải lại.');
      await this.activity.log(
        {
          actorId: adminId,
          action: 'model.renormalize',
          targetType: 'product3dmodel',
          targetId: modelId,
          changes: { ...p.options },
        },
        tx,
      );
    });
    const jobId = await this.jobs.enqueueModel({
      modelId,
      format: 'glb',
      lod: 'high',
      sourceKey: p.rawKey!,
      fileName: p.fileName,
      uploadedBy: adminId,
    });
    return { modelId, jobId, status: 'processing' };
  }

  /** Xóa mọi tệp private của một quy trình (tệp thô và các phiên bản chờ duyệt) */
  async dropPrivate(pipeline: ModelPipeline | null) {
    const keys = [...pendingKeysOf(pipeline), ...(pipeline?.rawKey ? [pipeline.rawKey] : [])];
    for (const k of keys) await this.storage.delete(k, 'private').catch(() => undefined);
  }

  private async dropMediaIfUnused(mediaId: number, filePath: string) {
    if (!filePath.startsWith('models/')) return;
    const used =
      (await this.prisma.modelFile.count({ where: { mediaId } })) +
      (await this.prisma.product3DModel.count({ where: { posterMediaId: mediaId } }));
    if (used) return;
    await this.storage.delete(filePath, 'public').catch(() => undefined);
    await this.prisma.media.delete({ where: { id: mediaId } }).catch(() => undefined);
  }
}
