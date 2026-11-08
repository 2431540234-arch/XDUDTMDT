// Tải ảnh lớn (frame 360°, panorama) lên từng tệp một bằng multipart (POST /admin/media) thay vì nhét base64 vào JSON
// (body JSON giới hạn 25 MB). Chế độ dữ liệu giả không có máy chủ nên vẫn dùng data-URL như trước.
import { readAsDataUrl } from '@/components/admin/UploadDropzone';
import type { PresignedUpload } from '@aurelia-living/shared-types';
import { USE_MOCK, http } from '@/services/api-client';
import { getUploadMode, putToStorage } from '@/services/direct-upload';

export type UploadKind = 'image' | 'frame' | 'panorama';

/**
 * Trả về URL ảnh đã lưu (máy chủ thật) hoặc data-URL (mock) để gửi lại cho API lưu cấu hình.
 * Kho MinIO/S3: panorama (≤ 20MB) đi bằng presigned PUT vào bucket public rồi confirm (UC-ADM-04 bước 2b);
 * ảnh thường và frame 360° (≤ 5MB / 2MB) vẫn multipart qua API. Driver local: mọi loại đều multipart.
 */
export async function uploadImageFile(file: File, kind: UploadKind): Promise<string> {
  if (USE_MOCK) return readAsDataUrl(file);
  if (kind === 'panorama' && (await getUploadMode()) === 'presigned') {
    const presigned = await http.post<PresignedUpload>('/admin/media/presign', {
      kind: 'panorama',
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
    await putToStorage(presigned, file);
    const media = await http.post<{ url: string }>('/admin/media/confirm', {
      key: presigned.key,
      kind: 'panorama',
      fileName: file.name,
      mimeType: file.type,
    });
    return media.url;
  }
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const media = await http.post<{ url: string }>('/admin/media', form);
  return media.url;
}

/** Chạy tối đa `limit` tải lên song song, giữ nguyên thứ tự kết quả */
export async function uploadMany(files: File[], kind: UploadKind, limit = 4): Promise<string[]> {
  const out: string[] = new Array(files.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, files.length) }, async () => {
      while (next < files.length) {
        const i = next++;
        out[i] = await uploadImageFile(files[i], kind);
      }
    }),
  );
  return out;
}
