// Kiểm tra tệp mô hình 3D tải lên: đuôi tệp, định dạng khai báo, dung lượng ≤ 100MB (UC-ADM-13), MIME, chữ ký tệp (magic bytes) và tên
// tệp an toàn (chống path traversal). Logic thuần để dễ unit test.
import { basename } from 'node:path';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';

export const MODEL_MAX_BYTES = 100 * 1024 * 1024;
export type ModelFormat = 'glb' | 'usdz';

/** Đuôi tệp hợp lệ → định dạng lưu trong DB (GLTF dạng JSON được lưu chung nhóm "glb") */
export const EXT_FORMAT: Record<string, { format: ModelFormat; mime: string }> = {
  glb: { format: 'glb', mime: 'model/gltf-binary' },
  gltf: { format: 'glb', mime: 'model/gltf+json' },
  usdz: { format: 'usdz', mime: 'model/vnd.usdz+zip' },
};

const ALLOWED_MIMES = new Set([
  'model/gltf-binary',
  'model/gltf+json',
  'model/vnd.usdz+zip',
  'application/octet-stream',
  'application/zip',
  'application/json',
]);

/** Chỉ lấy tên tệp (bỏ đường dẫn), loại ký tự điều khiển và dấu hiệu traversal; trả về chuỗi rỗng nếu không an toàn */
export function safeFileName(name: string): string {
  const noControl = [...basename(String(name ?? '').replace(/\\/g, '/'))]
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('');
  const base = noControl.trim();
  if (!base || base === '.' || base === '..' || base.includes('..') || base.length > 120) return '';
  return base;
}

export interface ModelFileCheck {
  fileName: string;
  sizeBytes: number;
  /** Định dạng FE khai báo (glb|usdz) – nếu có thì phải khớp đuôi tệp */
  declaredFormat?: string;
  mimeType?: string;
  /** Nội dung tệp nếu có (để kiểm tra chữ ký) */
  bytes?: Buffer;
}

const bad = (code: ErrorCode, msg: string) => new AppException(code, msg);

/** Ném AppException nếu tệp không hợp lệ; trả về { fileName, format, mime, ext } đã chuẩn hóa */
export function validateModelFile(c: ModelFileCheck): {
  fileName: string;
  format: ModelFormat;
  mime: string;
  ext: string;
} {
  const fileName = safeFileName(c.fileName);
  if (!fileName) throw bad(ErrorCode.BAD_REQUEST, 'Tên tệp không hợp lệ.');
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  const kind = EXT_FORMAT[ext];
  if (!kind) throw bad(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Chỉ hỗ trợ tệp GLB, GLTF hoặc USDZ.');
  if (c.declaredFormat && c.declaredFormat !== kind.format) {
    throw bad(
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      `Đuôi tệp .${ext} không khớp định dạng ${c.declaredFormat.toUpperCase()}.`,
    );
  }
  if (c.mimeType && !ALLOWED_MIMES.has(c.mimeType.toLowerCase())) {
    throw bad(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Loại MIME của tệp không được hỗ trợ.');
  }
  if (!(c.sizeBytes > 0)) throw bad(ErrorCode.BAD_REQUEST, 'Tệp rỗng.');
  if (c.sizeBytes > MODEL_MAX_BYTES)
    throw bad(ErrorCode.PAYLOAD_TOO_LARGE, 'Tệp phải nhỏ hơn hoặc bằng 100MB.');
  if (c.bytes) {
    const b = c.bytes;
    const ok =
      ext === 'glb'
        ? b.subarray(0, 4).toString('ascii') === 'glTF'
        : ext === 'usdz'
          ? b[0] === 0x50 && b[1] === 0x4b // ZIP: "PK"
          : b.subarray(0, 512).toString('utf8').trimStart().startsWith('{') &&
            b.toString('utf8', 0, Math.min(b.length, 4096)).includes('"asset"');
    if (!ok) throw bad(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Nội dung tệp không đúng định dạng đã chọn.');
  }
  return { fileName, format: kind.format, mime: kind.mime, ext };
}
