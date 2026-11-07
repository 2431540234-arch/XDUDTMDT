// M05 – Media: tải ảnh/panorama bằng presigned PUT (trình duyệt PUT thẳng lên MinIO), xác nhận rồi xử lý nền.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type PresignedUpload } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { asBody, str } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { derivedKeys } from '../jobs/image-processing/image-processing.service';
import { JobsService } from '../jobs/jobs.service';
import type { ConfirmUploadDto, PresignUploadDto } from './dto/media-upload.dto';

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const KEY_PREFIX = { image: 'images', panorama: 'panoramas' } as const;

/** Ảnh frame xoay 360°: tối đa 2 MB/ảnh (khớp media-ingest) */
const FRAME_MAX_BYTES = 2 * 1024 * 1024;

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
    private readonly activity: ActivityLogService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private maxBytes(kind: 'image' | 'panorama'): number {
    const mb =
      kind === 'panorama'
        ? this.config.get('UPLOAD_MAX_PANORAMA_MB')
        : this.config.get('UPLOAD_MAX_IMAGE_MB');
    return Math.floor(mb * 1024 * 1024);
  }

  /**
   * Tải MỘT tệp ảnh qua API (multipart, bộ nhớ) rồi ghi lên bucket public. `kind`:
   *  - image (mặc định): <= UPLOAD_MAX_IMAGE_MB; - frame (ảnh xoay 360°): <= 2 MB; - panorama: <= UPLOAD_MAX_PANORAMA_MB.
   * Dùng cho tệp lớn (từng frame/panorama) để không phải nhét base64 vào JSON (giới hạn body 25 MB).
   */
  async uploadImage(
    file: UploadedImage | undefined,
    uploadedBy: number,
    altText?: string,
    kind: 'image' | 'frame' | 'panorama' = 'image',
  ) {
    if (!file) throw new AppException(ErrorCode.BAD_REQUEST, 'Thiếu tệp ảnh (trường "file").');
    if (!IMAGE_MIME.includes(file.mimetype)) {
      throw new AppException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP.');
    }
    if (!matchesSignature(file.mimetype, file.buffer)) {
      throw new AppException(
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
        'Nội dung tệp không đúng định dạng ảnh đã khai báo.',
      );
    }
    const max =
      kind === 'frame' ? FRAME_MAX_BYTES : this.maxBytes(kind === 'panorama' ? 'panorama' : 'image');
    if (file.size > max) {
      throw new AppException(ErrorCode.PAYLOAD_TOO_LARGE, `Ảnh vượt quá ${max / 1024 / 1024} MB.`, {
        maxBytes: max,
      });
    }
    const month = new Date().toISOString().slice(0, 7).replace('-', '/');
    const key = `${kind === 'panorama' ? KEY_PREFIX.panorama : KEY_PREFIX.image}/${month}/${randomUUID()}${EXT_BY_MIME[file.mimetype]}`;
    await this.storage.upload({ key, body: file.buffer, contentType: file.mimetype, visibility: 'public' });
    const media = await this.prisma.$transaction(async (tx) => {
      const m = await tx.media.create({
        data: {
          fileName: safeName(file.originalname),
          filePath: key,
          mimeType: file.mimetype,
          fileSize: file.size,
          altText: altText ? altText.slice(0, 255) : undefined,
          uploadedBy,
        },
      });
      await this.activity.log(
        {
          actorId: uploadedBy,
          action: 'media.upload',
          targetType: 'media',
          targetId: m.id,
          changes: { key, kind, size: file.size },
        },
        tx,
      );
      return m;
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

  // ---------------------------------------------------------------- UC-ADM-04: thư viện media
  private view(m: MediaRow) {
    const c = m._count;
    const required =
      c.productImages +
      c.spacePanoramas +
      c.modelFiles +
      c.product360Frames +
      c.reviewImages +
      c.returnRequestImages +
      c.product3dModels +
      c.arSnapshots;
    const optional = c.brands + c.categories + c.spaces + c.usersAsAvatarMedia;
    return {
      id: m.id,
      fileName: m.fileName,
      url:
        /^(https?:)?\/\//.test(m.filePath) || m.filePath.startsWith('/')
          ? m.filePath
          : this.storage.getUrl(m.filePath),
      mimeType: m.mimeType,
      fileSize: m.fileSize,
      altText: m.altText,
      uploadedByName: m.uploadedByUser?.fullName ?? null,
      createdAt: m.createdAt,
      /** số nơi đang dùng: required chặn xóa (409), optional chỉ bị gỡ liên kết khi xóa */
      usage: { required, optional },
    };
  }

  /** GET /admin/media: phân trang, tìm theo tên/alt, lọc loại (image|model) */
  async list(q: RawQuery) {
    const kind = qStr(q, 'type');
    const where: Prisma.MediaWhereInput =
      kind === 'image'
        ? { mimeType: { startsWith: 'image/' } }
        : kind === 'other'
          ? { NOT: { mimeType: { startsWith: 'image/' } } }
          : {};
    // tìm không dấu và coi '-', '_', '.' trong tên tệp như khoảng trắng ("ban an" khớp ban-an-go.png)
    const words = (t: string) => foldVi(t).replace(/[-_.]+/g, ' ');
    const search = words(qStr(q, 'q'));
    let rows = await this.prisma.media.findMany({
      where,
      include: MEDIA_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (search) rows = rows.filter((m) => words(`${m.fileName} ${m.altText ?? ''}`).includes(search));
    const only = qStr(q, 'usage');
    if (only === 'unused')
      rows = rows.filter((m) => this.view(m).usage.required + this.view(m).usage.optional === 0);
    const page = resolvePage(q, rows.length, qNum(q, 'pageSize', 24));
    return {
      items: rows.slice(page.skip, page.skip + page.pageSize).map((m) => this.view(m)),
      page: page.page,
      pageSize: page.pageSize,
      total: rows.length,
    };
  }

  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.prisma.media.findUnique({ where: { id } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tệp không tồn tại.');
    const b = asBody(raw);
    const alt = b.altText === null ? '' : str(b.altText).trim();
    if (b.altText !== undefined && alt.length > 255)
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
        altText: ['Mô tả ảnh tối đa 255 ký tự.'],
      });
    await this.prisma.$transaction(async (tx) => {
      await tx.media.update({ where: { id }, data: { altText: alt || null } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'media.update',
          targetType: 'media',
          targetId: id,
          changes: { before: cur.altText, after: alt || null },
        },
        tx,
      );
    });
    return this.one(id);
  }

  private async one(id: number) {
    const m = await this.prisma.media.findUnique({ where: { id }, include: MEDIA_INCLUDE });
    if (!m) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tệp không tồn tại.');
    return this.view(m);
  }

  /**
   * Xóa: bản ghi bị chặn bởi khóa ngoại RESTRICT (ảnh sản phẩm, panorama, mô hình…) ⇒ 409; tham chiếu tùy chọn (logo, ảnh danh mục,
   * avatar, ảnh bìa) tự về NULL. Xóa tệp trên kho SAU khi xóa bản ghi thành công.
   */
  async remove(adminId: number, id: number) {
    const cur = await this.prisma.media.findUnique({ where: { id }, include: MEDIA_INCLUDE });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Tệp không tồn tại.');
    const usage = this.view(cur).usage;
    if (usage.required > 0) throw this.inUse(usage);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.media.delete({ where: { id } });
        await this.activity.log(
          {
            actorId: adminId,
            action: 'media.delete',
            targetType: 'media',
            targetId: id,
            changes: { fileName: cur.fileName, filePath: cur.filePath },
          },
          tx,
        );
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') throw this.inUse(usage);
      throw e;
    }
    if (!/^(https?:)?\/\//.test(cur.filePath) && !cur.filePath.startsWith('/')) {
      const d = derivedKeys(cur.filePath);
      for (const k of [cur.filePath, d.webpKey, d.thumbKey]) {
        await this.storage.delete(k, 'public').catch(() => undefined);
      }
    }
    return { id };
  }

  private inUse(usage: { required: number; optional: number }) {
    return new AppException(
      ErrorCode.RESOURCE_IN_USE,
      'Tệp đang được sử dụng (ảnh sản phẩm, không gian, mô hình…) nên không thể xóa.',
      { ...usage },
    );
  }
}

const MEDIA_INCLUDE = {
  uploadedByUser: { select: { fullName: true } },
  _count: {
    select: {
      productImages: true,
      spacePanoramas: true,
      modelFiles: true,
      product360Frames: true,
      reviewImages: true,
      returnRequestImages: true,
      product3dModels: true,
      arSnapshots: true,
      brands: true,
      categories: true,
      spaces: true,
      usersAsAvatarMedia: true,
    },
  },
} satisfies Prisma.MediaInclude;
type MediaRow = Prisma.MediaGetPayload<{ include: typeof MEDIA_INCLUDE }>;

/**
 * Tên tệp hiển thị: multer đọc tên trong multipart theo latin1 nên tên tiếng Việt bị lỗi dấu ⇒ giải mã lại thành UTF-8;
 * bỏ đường dẫn (../../x.png ⇒ x.png); tối đa 255 ký tự.
 */
function safeName(n: string): string {
  const utf8 = Buffer.from(n, 'latin1').toString('utf8');
  const name = utf8.includes('�') ? n : utf8;
  return (name.split(/[\\/]/).pop() || 'image').slice(0, 255);
}

/** Kiểm tra chữ ký tệp khớp MIME khai báo (không tin Content-Type của client) */
function matchesSignature(mime: string, b: Buffer): boolean {
  if (mime === 'image/png') return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/webp')
    return b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}
