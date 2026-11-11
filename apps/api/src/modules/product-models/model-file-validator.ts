// Kiểm tra tệp mô hình 3D tải lên: đuôi tệp, định dạng khai báo, dung lượng ≤ 100MB (UC-ADM-13), MIME, chữ ký tệp (magic bytes) và tên
// tệp an toàn (chống path traversal). Logic thuần để dễ unit test.
import { basename } from 'node:path';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';

export const MODEL_MAX_BYTES = 100 * 1024 * 1024;
export type ModelFormat = 'glb' | 'usdz';

/** AR ngoài phạm vi (D-P11): hệ thống chỉ nhận GLB; mọi định dạng khác ⇒ 415 với thông báo này */
export const ONLY_GLB_MESSAGE = 'Hệ thống chỉ hỗ trợ tệp GLB';

/** Đuôi tệp hợp lệ → định dạng lưu trong DB (chỉ GLB; enum DB vẫn có usdz theo chuẩn nhưng không dùng) */
export const EXT_FORMAT: Record<string, { format: ModelFormat; mime: string }> = {
  glb: { format: 'glb', mime: 'model/gltf-binary' },
};

const ALLOWED_MIMES = new Set(['model/gltf-binary', 'application/octet-stream']);

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
  if (!kind || (c.declaredFormat && c.declaredFormat !== 'glb'))
    throw bad(ErrorCode.UNSUPPORTED_MEDIA_TYPE, ONLY_GLB_MESSAGE);
  if (c.mimeType && !ALLOWED_MIMES.has(c.mimeType.toLowerCase())) {
    throw bad(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Loại MIME của tệp không được hỗ trợ.');
  }
  if (!(c.sizeBytes > 0)) throw bad(ErrorCode.BAD_REQUEST, 'Tệp rỗng.');
  if (c.sizeBytes > MODEL_MAX_BYTES)
    throw bad(ErrorCode.PAYLOAD_TOO_LARGE, 'Tệp phải nhỏ hơn hoặc bằng 100MB.');
  if (c.bytes) {
    const b = c.bytes;
    if (b.subarray(0, 4).toString('ascii') !== 'glTF')
      throw bad(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Nội dung tệp không đúng định dạng đã chọn.');
  }
  return { fileName, format: kind.format, mime: kind.mime, ext };
}
