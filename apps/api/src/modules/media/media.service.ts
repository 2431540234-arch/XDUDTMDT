// M05 – Media: tải ảnh/panorama bằng presigned PUT (trình duyệt PUT thẳng lên MinIO), xác nhận rồi xử lý nền.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type PresignedUpload } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import type { ConfirmUploadDto, PresignUploadDto } from './dto/media-upload.dto';

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const KEY_PREFIX = { image: 'images', panorama: 'panoramas' } as const;

export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly jobs: JobsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private maxBytes(kind: 'image' | 'panorama'): number {
    const mb =
      kind === 'panorama'
        ? this.config.get('UPLOAD_MAX_PANORAMA_MB')
        : this.config.get('UPLOAD_MAX_IMAGE_MB');
    return Math.floor(mb * 1024 * 1024);
  }

  /** Ảnh thường (<= UPLOAD_MAX_IMAGE_MB): tải qua API (multipart, bộ nhớ) rồi API ghi lên bucket public. */
  async uploadImage(file: UploadedImage | undefined, uploadedBy: number, altText?: string) {
    if (!file) throw new AppException(ErrorCode.BAD_REQUEST, 'Thiếu tệp ảnh (trường "file").');
    if (!IMAGE_MIME.includes(file.mimetype)) {
      throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
    }
    const max = this.maxBytes('image');
    if (file.size > max) {
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Ảnh vượt quá ${max / 1024 / 1024} MB.`, {
        maxBytes: max,
      });
    }
    const month = new Date().toISOString().slice(0, 7).replace('-', '/');
    const key = `${KEY_PREFIX.image}/${month}/${randomUUID()}${EXT_BY_MIME[file.mimetype]}`;
    await this.storage.upload({ key, body: file.buffer, contentType: file.mimetype, visibility: 'public' });
    const media = await this.prisma.media.create({
      data: {
        fileName: file.originalname.slice(0, 255),
        filePath: key,
        mimeType: file.mimetype,
        fileSize: file.size,
        altText,
        uploadedBy,
      },
    });
    const jobId = await this.jobs.enqueueImage({ mediaId: media.id, key, kind: 'image' });
    return { ...media, url: this.storage.getUrl(key), jobId };
  }

  /** Bước 1 (panorama): kiểm tra loại tệp, dung lượng, rồi cấp URL PUT (tệp vào bucket public). */
  async presign(dto: PresignUploadDto): Promise<PresignedUpload> {
    if (!IMAGE_MIME.includes(dto.mimeType)) {
      throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
    }
    const max = this.maxBytes('panorama');
    if (dto.size > max) {
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Tệp vượt quá ${max / 1024 / 1024} MB.`, {
        maxBytes: max,
      });
    }
    const month = new Date().toISOString().slice(0, 7).replace('-', '/');
    const key = `${KEY_PREFIX[dto.kind]}/${month}/${randomUUID()}${EXT_BY_MIME[dto.mimeType]}`;
    const p = await this.storage.presignPut({
      key,
      contentType: dto.mimeType,
      size: dto.size,
      visibility: 'public',
    });
    return { key, uploadUrl: p.url, method: 'PUT', headers: p.headers, expiresIn: p.expiresIn };
  }

  /** Bước 3: sau khi client PUT xong, xác nhận tệp thật sự có mặt, tạo media và đẩy job tạo webp/thumbnail. */
  async confirm(dto: ConfirmUploadDto, uploadedBy: number) {
    if (!dto.key.startsWith(`${KEY_PREFIX[dto.kind]}/`) || dto.key.includes('..')) {
      throw new AppException(ErrorCode.BAD_REQUEST, 'Khóa tệp không hợp lệ.');
    }
    const info = await this.storage.head(dto.key, 'public');
    if (!info)
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Chưa thấy tệp trên kho, hãy tải lên trước.');
    const max = this.maxBytes('panorama');
    if (info.size > max || info.size === 0) {
      await this.storage.delete(dto.key, 'public');
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Tệp vượt quá ${max / 1024 / 1024} MB.`);
    }
    const media = await this.prisma.media.create({
      data: {
        fileName: dto.fileName,
        filePath: dto.key,
        mimeType: info.contentType ?? dto.mimeType,
        fileSize: info.size,
        altText: dto.altText,
        uploadedBy,
      },
    });
    const jobId = await this.jobs.enqueueImage({ mediaId: media.id, key: dto.key, kind: dto.kind });
    return { ...media, url: this.storage.getUrl(media.filePath), jobId };
  }
}
