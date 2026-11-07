// Logic xử lý mô hình 3D (UC-ADM-13), KHÔNG phụ thuộc BullMQ/HTTP (để processor tách sang apps/worker mà không sửa).
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ActivityLogService } from '../../../activity-log/activity-log.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../../storage/storage.service';
import { NotificationsService } from '../../notifications/notifications.service';
import type { LodName, ModelJobData } from '../jobs.constants';
import { buildLod, measure, readGlb, type LodOutput } from './glb-tools';

/** Lỗi do dữ liệu đầu vào (tệp hỏng...): thử lại cũng vô ích nên không retry. */
export class InvalidModelFileError extends Error {}
/** LOD vượt ngưỡng dung lượng cho web (D-N21): chạy lại cũng cho kết quả y hệt nên không retry. */
export class ModelTooLargeError extends InvalidModelFileError {}

export interface ModelProcessingResult {
  modelId: number;
  files: { format: 'glb' | 'usdz'; lod: LodName; key: string; polygonCount: number | null }[];
}

interface FileToSave {
  format: 'glb' | 'usdz';
  lod: LodName;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  polygonCount: number | null;
  textureResolution: number | null;
  isCompressed: boolean;
  checksum: string;
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const LODS: LodName[] = ['high', 'medium', 'low'];
const stemOf = (fileName: string) =>
  basename(fileName, extname(fileName)).replace(/[^a-zA-Z0-9_-]/g, '-') || 'model';
const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

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

    const source = await this.storage.download(data.sourceKey, 'private');
    const files =
      data.format === 'glb' ? await this.prepareGlb(data, source) : this.prepareUsdz(data, source);

    // Tệp lên kho trước, bản ghi CSDL sau: nếu giữa chừng lỗi thì chưa có bản ghi nào trỏ tới tệp thiếu
    for (const f of files) {
      await this.storage.upload({ key: f.key, body: f.body, contentType: f.mimeType, visibility: 'public' });
    }
    const replaced = await this.saveAll(data, files);
    // Dọn tệp của lần tải lên trước (tên khác) mà không còn bản ghi nào dùng
    for (const key of replaced) await this.storage.delete(key, 'public').catch(() => undefined);

    this.logger.log(`Mô hình ${data.modelId} (${data.format}) xử lý xong: ${files.length} tệp.`);
    return {
      modelId: data.modelId,
      files: files.map((f) => ({ format: f.format, lod: f.lod, key: f.key, polygonCount: f.polygonCount })),
    };
  }

  /**
   * Gọi khi job thất bại hẳn (hết lần thử hoặc lỗi không thể retry): trong MỘT transaction đặt `failed`,
   * ghi `activity_logs` (`model.processing_failed`) và tạo thông báo cho admin đã tải lên (D-N21, D-N22).
   */
  async markFailed(data: ModelJobData, reason: string): Promise<void> {
    // Tệp USDZ (AR) lỗi không làm mất bản xem web: còn GLB thì giữ nguyên `ready`, vẫn ghi log và báo admin
    const keepReady =
      data.format === 'usdz' &&
      (await this.prisma.modelFile.count({ where: { modelId: data.modelId, format: 'glb' } })) > 0;
    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.product3DModel.count({ where: { id: data.modelId } });
      if (!exists) return; // mô hình đã bị xóa trong lúc xử lý
      if (!keepReady) {
        await tx.product3DModel.update({ where: { id: data.modelId }, data: { status: 'failed' } });
      }
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

  /** Kiểm tra GLB, sinh 3 LOD, đo số liệu, kiểm tra ngưỡng dung lượng cho web (D-N21). */
  private async prepareGlb(data: ModelJobData, source: Buffer) {
    try {
      measure(await readGlb(source)); // kiểm tra hợp lệ trước khi tốn công sinh LOD
    } catch (e) {
      throw new InvalidModelFileError((e as Error).message);
    }
    const outputs: LodOutput[] = [];
    for (const lod of LODS) outputs.push(await buildLod(source, lod));

    const limit = Math.floor(this.config.get('MODEL_SERVE_MAX_MB') * 1024 * 1024);
    const tooBig = outputs.filter((o) => o.buffer.length > limit);
    if (tooBig.length) {
      const list = tooBig.map((o) => `${o.lod} ${mb(o.buffer.length)} MB`).join(', ');
      throw new ModelTooLargeError(
        `Tệp LOD vượt ngưỡng ${this.config.get('MODEL_SERVE_MAX_MB')} MB dùng cho web (${list}). Hãy giảm số đa giác hoặc kích thước texture rồi tải lại.`,
      );
    }
    const stem = stemOf(data.fileName);
    return outputs.map((o) => ({
      format: 'glb' as const,
      lod: o.lod,
      key: `models/${data.modelId}/${stem}-${o.lod}.glb`,
      fileName: `${stem}-${o.lod}.glb`,
      mimeType: 'model/gltf-binary',
      size: o.buffer.length,
      polygonCount: o.polygonCount,
      textureResolution: o.textureResolution,
      isCompressed: o.compressed,
      checksum: sha256(o.buffer),
      body: o.buffer,
    }));
  }

  /** USDZ do admin tải thủ công: chỉ kiểm tra chữ ký ZIP, tính checksum rồi chép sang bucket public. */
  private prepareUsdz(data: ModelJobData, source: Buffer) {
    if (source.length < 4 || source.readUInt32LE(0) !== 0x04034b50) {
      throw new InvalidModelFileError('Tệp không phải USDZ hợp lệ (không phải ZIP).');
    }
    const stem = stemOf(data.fileName);
    return [
      {
        format: 'usdz' as const,
        lod: data.lod,
        key: `models/${data.modelId}/${stem}-${data.lod}.usdz`,
        fileName: `${stem}-${data.lod}.usdz`,
        mimeType: 'model/vnd.usdz+zip',
        size: source.length,
        polygonCount: null,
        textureResolution: null,
        isCompressed: false,
        checksum: sha256(source),
        body: source,
      },
    ];
  }

  /**
   * Một transaction: tạo/cập nhật media + model_files của MỌI LOD rồi mới đặt `ready`.
   * Idempotent: chạy lại (retry, tải lại cùng định dạng/LOD) ghi đè bản ghi cũ qua upsert, không nhân đôi.
   * Trả về các khóa tệp cũ không còn được tham chiếu để dọn.
   */
  private async saveAll(data: ModelJobData, files: FileToSave[]): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const orphanCandidates: { id: number; filePath: string }[] = [];
      for (const f of files) {
        const media = await tx.media.upsert({
          where: { filePath: f.key },
          update: { fileSize: f.size, mimeType: f.mimeType, fileName: f.fileName },
          create: {
            fileName: f.fileName,
            filePath: f.key,
            mimeType: f.mimeType,
            fileSize: f.size,
            uploadedBy: data.uploadedBy,
          },
        });
        const where = { modelId_format_lod: { modelId: data.modelId, format: f.format, lod: f.lod } };
        const old = await tx.modelFile.findUnique({ where, include: { media: true } });
        if (old && old.mediaId !== media.id)
          orphanCandidates.push({ id: old.mediaId, filePath: old.media.filePath });
        const fields = {
          mediaId: media.id,
          polygonCount: f.polygonCount,
          textureResolution: f.textureResolution,
          isCompressed: f.isCompressed,
          checksum: f.checksum,
        };
        await tx.modelFile.upsert({
          where,
          update: fields,
          create: { modelId: data.modelId, format: f.format, lod: f.lod, ...fields },
        });
      }
      await tx.product3DModel.update({ where: { id: data.modelId }, data: { status: 'ready' } });

      const orphans: string[] = [];
      for (const o of orphanCandidates) {
        const used =
          (await tx.modelFile.count({ where: { mediaId: o.id } })) +
          (await tx.product3DModel.count({ where: { posterMediaId: o.id } }));
        if (!used && o.filePath.startsWith('models/')) {
          await tx.media.deleteMany({ where: { id: o.id } });
          orphans.push(o.filePath);
        }
      }
      return orphans;
    });
  }
}
