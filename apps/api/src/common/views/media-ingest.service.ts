// Nhận ảnh/tệp từ FE ở dạng data-URL (base64) hoặc URL, kiểm tra MIME bằng chữ ký tệp + dung lượng, lưu vào kho
// (StorageService) và tạo bản ghi media. FE (mock) gửi ảnh đại diện, ảnh đánh giá/đổi trả, frame 360 theo cách này.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { AppException } from '../exceptions/app.exception';

export type MediaKind = 'image' | 'model';

const IMAGE_SIGNATURES: Array<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 3).toString('ascii') === 'GIF' },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

const LIMITS_MB = { image: 5, frame: 2, model: 50 } as const;

@Injectable()
export class MediaIngestService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /**
   * - data-URL ảnh: giải mã, kiểm tra chữ ký + dung lượng, lưu kho, tạo media → trả id
   * - URL/đường dẫn đã có (http(s) hoặc /…): tạo media tham chiếu trực tiếp (không tải về)
   */
  async ingestImage(
    input: string,
    opts: { userId: number | null; folder: string; maxMB?: number; alt?: string | null },
  ): Promise<number> {
    const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(input);
    if (!m) {
      if (/^(https?:\/\/|\/)/.test(input)) {
        const existing = await this.prisma.media.findUnique({ where: { filePath: input } });
        if (existing) return existing.id;
        const row = await this.prisma.media.create({
          data: {
            fileName: input.split('/').pop()!.split('?')[0] || 'image',
            filePath: input,
            mimeType: 'image/*',
            fileSize: 0,
            altText: opts.alt ?? null,
            uploadedBy: opts.userId,
          },
        });
        return row.id;
      }
      throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Tệp ảnh không hợp lệ.');
    }
    const body = Buffer.from(m[2], 'base64');
    const maxMB = opts.maxMB ?? LIMITS_MB.image;
    if (body.length > maxMB * 1024 * 1024) {
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Ảnh vượt quá ${maxMB}MB.`);
    }
    const sig = IMAGE_SIGNATURES.find((s) => s.test(body));
    if (!sig)
      throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Chỉ chấp nhận ảnh PNG, JPEG, WEBP, GIF.');
    // tên tệp do server sinh (uuid) ⇒ không thể path traversal
    const key = `${opts.folder.replace(/[^a-z0-9/_-]/gi, '')}/${randomUUID()}.${sig.ext}`;
    await this.storage.upload({ key, body, contentType: sig.mime, visibility: 'public' });
    const row = await this.prisma.media.create({
      data: {
        fileName: key.split('/').pop()!,
        filePath: key,
        mimeType: sig.mime,
        fileSize: body.length,
        altText: opts.alt ?? null,
        uploadedBy: opts.userId,
      },
    });
    return row.id;
  }

  readonly limits = LIMITS_MB;
}
