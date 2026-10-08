// Logic xử lý mô hình 3D, KHÔNG phụ thuộc BullMQ/HTTP (để processor tách sang apps/worker mà không sửa).
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../../storage/storage.service';
import type { LodName, ModelJobData } from '../jobs.constants';
import { buildLod, measure, readGlb } from './glb-tools';

/** Lỗi do dữ liệu đầu vào (tệp hỏng...): thử lại cũng vô ích nên không retry. */
export class InvalidModelFileError extends Error {}

export interface ModelProcessingResult {
  modelId: number;
  files: { format: 'glb' | 'usdz'; lod: LodName; key: string; polygonCount: number | null }[];
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const LODS: LodName[] = ['high', 'medium', 'low'];

@Injectable()
export class ModelProcessingService {
  private readonly logger = new Logger(ModelProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async process(data: ModelJobData): Promise<ModelProcessingResult> {
    const model = await this.prisma.product3DModel.findUnique({ where: { id: data.modelId } });
    if (!model) throw new InvalidModelFileError(`Không tìm thấy mô hình ${data.modelId}.`);

    const source = await this.storage.download(data.sourceKey, 'private');
    const result =
      data.format === 'glb' ? await this.processGlb(data, source) : await this.processUsdz(data, source);

    await this.prisma.product3DModel.update({ where: { id: data.modelId }, data: { status: 'ready' } });
    this.logger.log(`Mô hình ${data.modelId} (${data.format}) xử lý xong: ${result.files.length} tệp.`);
    return result;
  }

  /** Gọi khi job thất bại hẳn (hết lần thử hoặc lỗi không thể retry). */
  async markFailed(modelId: number, reason: string): Promise<void> {
    const readyFiles = await this.prisma.modelFile.count({ where: { modelId } });
    // Còn tệp hợp lệ từ trước (ví dụ thay thế USDZ lỗi) thì không hạ trạng thái mô hình
    await this.prisma.product3DModel.update({
      where: { id: modelId },
      data: { status: readyFiles > 0 ? 'ready' : 'failed' },
    });
    this.logger.warn(`Mô hình ${modelId} xử lý thất bại: ${reason}`);
  }

  private async processGlb(data: ModelJobData, source: Buffer): Promise<ModelProcessingResult> {
    try {
      measure(await readGlb(source)); // kiểm tra hợp lệ trước khi tốn công sinh LOD
    } catch (e) {
      throw new InvalidModelFileError((e as Error).message);
    }

    const stem = basename(data.fileName, extname(data.fileName)).replace(/[^a-zA-Z0-9_-]/g, '-') || 'model';
    const outputs = [];
    for (const lod of LODS) outputs.push(await buildLod(source, lod));

    const files: ModelProcessingResult['files'] = [];
    for (const out of outputs) {
      const key = `models/${data.modelId}/${stem}-${out.lod}.glb`;
      await this.storage.upload({
        key,
        body: out.buffer,
        contentType: 'model/gltf-binary',
        visibility: 'public',
      });
      await this.saveFile(data, {
        format: 'glb',
        lod: out.lod,
        key,
        fileName: `${stem}-${out.lod}.glb`,
        mimeType: 'model/gltf-binary',
        size: out.buffer.length,
        polygonCount: out.polygonCount,
        textureResolution: out.textureResolution,
        isCompressed: out.compressed,
        checksum: sha256(out.buffer),
      });
      files.push({ format: 'glb', lod: out.lod, key, polygonCount: out.polygonCount });
    }
    return { modelId: data.modelId, files };
  }

  /** USDZ do admin tải thủ công: chỉ kiểm tra chữ ký ZIP, tính checksum rồi chép sang bucket public. */
  private async processUsdz(data: ModelJobData, source: Buffer): Promise<ModelProcessingResult> {
    if (source.length < 4 || source.readUInt32LE(0) !== 0x04034b50) {
      throw new InvalidModelFileError('Tệp không phải USDZ hợp lệ (không phải ZIP).');
    }
    const stem = basename(data.fileName, extname(data.fileName)).replace(/[^a-zA-Z0-9_-]/g, '-') || 'model';
    const key = `models/${data.modelId}/${stem}-${data.lod}.usdz`;
    await this.storage.upload({ key, body: source, contentType: 'model/vnd.usdz+zip', visibility: 'public' });
    await this.saveFile(data, {
      format: 'usdz',
      lod: data.lod,
      key,
      fileName: `${stem}-${data.lod}.usdz`,
      mimeType: 'model/vnd.usdz+zip',
      size: source.length,
      polygonCount: null,
      textureResolution: null,
      isCompressed: false,
      checksum: sha256(source),
    });
    return { modelId: data.modelId, files: [{ format: 'usdz', lod: data.lod, key, polygonCount: null }] };
  }

  /** Idempotent: chạy lại job (retry) cập nhật bản ghi cũ, không nhân đôi. */
  private async saveFile(
    data: ModelJobData,
    f: {
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
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
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
      const fields = {
        mediaId: media.id,
        polygonCount: f.polygonCount,
        textureResolution: f.textureResolution,
        isCompressed: f.isCompressed,
        checksum: f.checksum,
      };
      await tx.modelFile.upsert({
        where: { modelId_format_lod: { modelId: data.modelId, format: f.format, lod: f.lod } },
        update: fields,
        create: { modelId: data.modelId, format: f.format, lod: f.lod, ...fields },
      });
    });
  }
}
