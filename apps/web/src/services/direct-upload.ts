// Tải thẳng lên kho (MinIO/S3) bằng URL ký sẵn khi máy chủ dùng driver minio/s3; driver local (hoặc dữ liệu giả) dùng multipart
// qua API như cũ. FE tự chọn theo cấu hình của máy chủ (GET /admin/media/upload-config).
import type { PresignedUpload } from '@aurelia-living/shared-types';
import { USE_MOCK, http } from '@/services/api-client';

export type UploadMode = 'presigned' | 'multipart';

let modePromise: Promise<UploadMode> | undefined;

/** Cách tải lên hiện dùng (được nhớ lại sau lần gọi đầu). Dữ liệu giả và lỗi cấu hình ⇒ multipart. */
export function getUploadMode(): Promise<UploadMode> {
  if (USE_MOCK) return Promise.resolve('multipart');
  modePromise ??= http
    .get<{ mode: UploadMode }>('/admin/media/upload-config')
    .then((c) => c.mode)
    .catch(() => {
      modePromise = undefined; // lần sau thử lại
      return 'multipart' as const;
    });
  return modePromise;
}

/** Dùng cho test: quên cấu hình đã nhớ */
export function resetUploadModeCache() {
  modePromise = undefined;
}

/**
 * PUT tệp thẳng lên kho theo URL ký sẵn. URL đã ký Content-Type và Content-Length nên chỉ gửi đúng các header được cấp;
 * trình duyệt tự đặt Content-Length theo dung lượng thật. `onProgress` nhận phần trăm 0–100.
 */
export function putToStorage(
  presigned: Pick<PresignedUpload, 'uploadUrl' | 'headers'>,
  file: Blob,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presigned.uploadUrl);
    for (const [k, v] of Object.entries(presigned.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Kho tệp từ chối tệp (${xhr.status}). URL tải lên có thể đã hết hạn, hãy thử lại.`));
      }
    };
    xhr.onerror = () => reject(new Error('Không kết nối được kho tệp (MinIO). Kiểm tra dịch vụ và CORS.'));
    xhr.send(file);
  });
}
