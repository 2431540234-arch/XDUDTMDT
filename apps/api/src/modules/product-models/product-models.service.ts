// M12 – Mô hình 3D: tải tệp gốc bằng presigned PUT (bucket private), xác nhận, xử lý nền (model-processing).
// Bảng: product_3d_models, model_files, model_material_variants
// TRẠNG THÁI: mới có luồng presign/confirm tệp mô hình; CRUD mô hình, mô hình chính, biến thể chất liệu chưa cài đặt.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type ModelProcessingAccepted, type PresignedUpload } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import type { ConfirmModelFileDto, PresignModelFileDto } from './dto/model-file.dto';

const FORMATS = {
  glb: { mime: 'model/gltf-binary', ext: 'glb' },
  usdz: { mime: 'model/vnd.usdz+zip', ext: 'usdz' },
} as const;

@Injectable()
export class ProductModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly jobs: JobsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private get maxBytes() {
    return Math.floor(this.config.get('UPLOAD_MAX_MODEL_MB') * 1024 * 1024);
  }

  private async requireModel(id: number) {
    const model = await this.prisma.product3DModel.findUnique({ where: { id } });
    if (!model) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không tìm thấy mô hình 3D.');
    return model;
  }

  async presignFile(modelId: number, dto: PresignModelFileDto): Promise<PresignedUpload> {
    await this.requireModel(modelId);
    if (dto.size > this.maxBytes) {
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Tệp vượt quá ${this.maxBytes / 1024 / 1024} MB.`, {
        maxBytes: this.maxBytes,
      });
    }
    const f = FORMATS[dto.format];
    const key = `models/incoming/${modelId}/${randomUUID()}.${f.ext}`;
    // Tệp gốc vào bucket PRIVATE; chỉ bản đã xử lý mới sang bucket public
    const p = await this.storage.presignPut({
      key,
      contentType: f.mime,
      size: dto.size,
      visibility: 'private',
    });
    return { key, uploadUrl: p.url, method: 'PUT', headers: p.headers, expiresIn: p.expiresIn };
  }

  async confirmFile(
    modelId: number,
    dto: ConfirmModelFileDto,
    adminId: number,
  ): Promise<ModelProcessingAccepted> {
    await this.requireModel(modelId);
    if (!dto.key.startsWith(`models/incoming/${modelId}/`) || dto.key.includes('..')) {
      throw new AppException(ErrorCode.BAD_REQUEST, 'Khóa tệp không hợp lệ.');
    }
    const info = await this.storage.head(dto.key, 'private');
    if (!info)
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Chưa thấy tệp trên kho, hãy tải lên trước.');
    if (info.size === 0 || info.size > this.maxBytes) {
      await this.storage.delete(dto.key, 'private');
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Tệp vượt quá ${this.maxBytes / 1024 / 1024} MB.`);
    }

    await this.prisma.product3DModel.update({ where: { id: modelId }, data: { status: 'processing' } });
    const jobId = await this.jobs.enqueueModel({
      modelId,
      format: dto.format,
      lod: dto.lod ?? 'high',
      sourceKey: dto.key,
      fileName: dto.fileName,
      uploadedBy: adminId,
    });
    return { modelId, jobId, status: 'processing' };
  }
}
