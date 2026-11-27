// Logic xử lý mô hình 3D (UC-ADM-13), KHÔNG phụ thuộc BullMQ/HTTP (để processor tách sang apps/worker mà không sửa).
// Tệp GLB thô (private) → chuẩn hóa → 3 LOD (private) → `pending_review`. Chỉ bước DUYỆT mới đưa tệp ra bucket public.
import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ActivityLogService } from '../../../activity-log/activity-log.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../../storage/storage.service';
import { NotificationsService } from '../../notifications/notifications.service';
import type { LodName, ModelJobData } from '../jobs.constants';
import { buildLod, readGlb, type LodOutput } from './glb-tools';
import {
  pendingKey,
  readPipeline,
  withPipeline,
  type ModelPipeline,
  type PipelineFile,
  type PipelineVariant,
  type VariantKey,
} from './model-pipeline';
import { detectFloor, normalizeModel, type FloorDetection, type TargetSizeMm } from './normalize';

/** Lỗi do dữ liệu đầu vào (tệp hỏng...): thử lại cũng vô ích nên không retry. */
export class InvalidModelFileError extends Error {}
/** LOD vượt ngưỡng dung lượng cho web (D-N21): chạy lại cũng cho kết quả y hệt nên không retry. */
export class ModelTooLargeError extends InvalidModelFileError {}

export interface ModelProcessingResult {
  modelId: number;
  files: { format: 'glb' | 'usdz'; lod: LodName; key: string; polygonCount: number | null }[];
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const LODS: LodName[] = ['high', 'medium', 'low'];
const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

/** Khóa của mọi tệp tạm (private) mà một quy trình đang giữ, trừ tệp thô */
export const pendingKeysOf = (pipeline: ModelPipeline | null): string[] =>
  Object.values(pipeline?.variants ?? {}).flatMap((v) => Object.values(v!.files).map((f) => f.key));

@Injectable()
export class ModelProcessingService {
  private readonly logger = new Logger(ModelProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async process(data: ModelJobData): Promise<ModelProcessingResult> {
    const model = await this.prisma.product3DModel.findUnique({ where: { id: data.modelId } });
    if (!model) throw new InvalidModelFileError(`Không tìm thấy mô hình ${data.modelId}.`);
    // AR ngoài phạm vi (D-P11): chỉ xử lý GLB; job USDZ cũ còn sót trong hàng đợi bị loại, không retry
    if (data.format !== 'glb') throw new InvalidModelFileError('Hệ thống chỉ hỗ trợ tệp GLB');
    // chỉ xử lý mô hình đang chờ xử lý: job cũ chạy lại không được kéo mô hình đã duyệt về chờ duyệt
    if (model.status !== 'processing')
      throw new InvalidModelFileError(`Mô hình ${model.id} không ở trạng thái đang xử lý (${model.status}).`);

    const pipeline: ModelPipeline = readPipeline(model.viewerConfig) ?? {
      source: 'upload',
      stage: 'normalizing',
      createdAt: model.createdAt.toISOString(),
      createdBy: data.uploadedBy,
      fileName: data.fileName,
      options: { removeFloor: true, yawDeg: 0 },
    };
    const stale = pendingKeysOf(pipeline);
    pipeline.rawKey = data.sourceKey;
    pipeline.stage = 'normalizing';
    delete pipeline.error;
    delete pipeline.variants;
    await this.prisma.product3DModel.update({
      where: { id: model.id },
      data: { viewerConfig: withPipeline(model.viewerConfig, pipeline) as never },
    });

    const source = await this.storage.download(data.sourceKey, 'private');
    pipeline.rawBytes = source.length;
    const target = { length: model.lengthMm, width: model.widthMm, height: model.heightMm };
    const prepared = await this.prepare(model.id, pipeline, source, target);

    // tệp lên kho trước, bản ghi CSDL sau: lỗi giữa chừng thì chưa có bản ghi nào trỏ tới tệp thiếu
    for (const f of prepared.uploads) {
      await this.storage.upload({
        key: f.key,
        body: f.body,
        contentType: 'model/gltf-binary',
        visibility: 'private',
      });
    }
    pipeline.variants = prepared.variants;
    pipeline.stage = 'review';
    delete pipeline.chosen;

    const saved = await this.prisma.$transaction(async (tx) => {
      const r = await tx.product3DModel.updateMany({
        where: { id: model.id, status: 'processing' },
        data: { status: 'pending_review', viewerConfig: withPipeline(model.viewerConfig, pipeline) as never },
      });
      if (!r.count) return false;
      if (data.uploadedBy)
        await this.notifications.notify(
          tx,
          data.uploadedBy,
          `Mô hình 3D chờ duyệt: ${data.fileName}`,
          'system',
          'Hãy xem thử rồi duyệt hoặc bỏ mô hình.',
          `/admin/products/${model.productId}`,
        );
      return true;
    });

    const keys = new Set(prepared.uploads.map((u) => u.key));
    // mô hình bị bỏ trong lúc xử lý ⇒ dọn tệp vừa tải; ngược lại dọn tệp của lần chuẩn hóa trước
    const garbage = saved ? stale.filter((k) => !keys.has(k)) : [...keys];
    for (const key of garbage) await this.storage.delete(key, 'private').catch(() => undefined);

    this.logger.log(
      `Mô hình ${model.id} chuẩn hóa xong, chờ duyệt (${Object.keys(prepared.variants).join(', ')}).`,
    );
    const first = prepared.variants.cleaned ?? prepared.variants.original!;
    return {
      modelId: model.id,
      files: LODS.map((lod) => ({
        format: 'glb' as const,
        lod,
        key: first.files[lod].key,
        polygonCount: first.files[lod].polygonCount,
      })),
    };
  }

  /**
   * Gọi khi job thất bại hẳn (hết lần thử hoặc lỗi không thể retry): trong MỘT transaction đặt `failed`,
   * ghi `activity_logs` (`model.processing_failed`) và tạo thông báo cho admin đã tải lên (D-N21, D-N22).
   */
  async markFailed(data: ModelJobData, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const model = await tx.product3DModel.findUnique({ where: { id: data.modelId } });
      // đã bị bỏ trong lúc xử lý, hoặc không còn ở trạng thái đang xử lý
      if (!model || model.status !== 'processing') return;
      const pipeline = readPipeline(model.viewerConfig);
      if (pipeline) {
        pipeline.stage = 'failed';
        pipeline.error = { message: reason, at: new Date().toISOString() };
      }
      await tx.product3DModel.update({
        where: { id: data.modelId },
        data: {
          status: 'failed',
          ...(pipeline ? { viewerConfig: withPipeline(model.viewerConfig, pipeline) as never } : {}),
        },
      });
      await this.activity.log(
        {
          actorId: data.uploadedBy,
          action: 'model.processing_failed',
          targetType: 'product3dmodel',
          targetId: data.modelId,
          changes: { reason, format: data.format, fileName: data.fileName },
        },
        tx,
      );
      if (data.uploadedBy) {
        await this.notifications.notify(
          tx,
          data.uploadedBy,
          `Xử lý mô hình 3D thất bại: ${data.fileName}`,
          'system',
          reason,
          '/admin/models',
        );
      }
    });
    this.logger.warn(`Mô hình ${data.modelId} xử lý thất bại: ${reason}`);
  }

  /** Chuẩn hóa các phiên bản (có/không tấm sàn), sinh 3 LOD mỗi phiên bản, kiểm tra ngưỡng dung lượng cho web (D-N21). */
  private async prepare(modelId: number, pipeline: ModelPipeline, source: Buffer, target: TargetSizeMm) {
    let floor: FloorDetection | null = null;
    try {
      await readGlb(source); // kiểm tra hợp lệ trước khi tốn công xử lý
      if (pipeline.options.removeFloor) floor = await detectFloor(source);
    } catch (e) {
      throw new InvalidModelFileError((e as Error).message);
    }
    const limit = Math.floor(this.config.get('MODEL_SERVE_MAX_MB') * 1024 * 1024);
    const plan: Array<[VariantKey, FloorDetection | null]> = floor
      ? [
          ['cleaned', floor],
          ['original', null],
        ]
      : [['original', null]];
    const variants: Partial<Record<VariantKey, PipelineVariant>> = {};
    const uploads: Array<{ key: string; body: Buffer }> = [];
    const tooBig: string[] = [];
    for (const [variant, cut] of plan) {
      const outputs: LodOutput[] = [];
      let report: PipelineVariant['report'];
      try {
        const normalized = await normalizeModel(
          source,
          { target, source: pipeline.source, yawDeg: pipeline.options.yawDeg },
          cut,
        );
        report = normalized.report;
        for (const lod of LODS) outputs.push(await buildLod(normalized.buffer, lod));
      } catch (e) {
        throw new InvalidModelFileError((e as Error).message);
      }
      const over = outputs.filter((o) => o.buffer.length > limit);
      if (over.length) {
        tooBig.push(...over.map((o) => `${o.lod} ${mb(o.buffer.length)} MB`));
        continue;
      }
      const files = {} as Record<LodName, PipelineFile>;
      for (const o of outputs) {
        const checksum = sha256(o.buffer);
        const key = pendingKey(modelId, variant, o.lod, checksum);
        files[o.lod] = {
          key,
          size: o.buffer.length,
          polygonCount: o.polygonCount,
          textureResolution: o.textureResolution,
          isCompressed: o.compressed,
          checksum,
        };
        uploads.push({ key, body: o.buffer });
      }
      variants[variant] = { files, report };
    }
    if (!Object.keys(variants).length) {
      throw new ModelTooLargeError(
        `Tệp LOD vượt ngưỡng ${this.config.get('MODEL_SERVE_MAX_MB')} MB dùng cho web (${tooBig.join(', ')}). Hãy giảm số đa giác hoặc kích thước texture rồi tải lại.`,
      );
    }
    return { variants, uploads };
  }
}
