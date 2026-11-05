// Sổ đăng ký bản ghi `media` – các bảng khác gọi registerMedia() để lấy mediaId (khóa ngoại) hợp lệ.
import type { Media } from '@aurelia-living/shared-types';
import { MOCK_NOW, iso } from './rng';

export const mediaRows: Media[] = [];
const byPath = new Map<string, number>();

export function registerMedia(
  filePath: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  altText: string | null = null,
  uploadedBy: number | null = 1,
): number {
  const existing = byPath.get(filePath);
  if (existing) return existing;
  const id = mediaRows.length + 1;
  const d = iso(MOCK_NOW);
  mediaRows.push({
    id,
    fileName,
    filePath,
    mimeType,
    fileSize,
    altText,
    uploadedBy,
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: d,
  });
  byPath.set(filePath, id);
  return id;
}

/** filePath → URL hiển thị. Mock: đường dẫn bắt đầu bằng '/' dùng trực tiếp; ngược lại coi là khóa object và bỏ tiền tố. */
export function mediaUrl(id: number | null | undefined): string | null {
  if (!id) return null;
  const m = mediaRows.find((x) => x.id === id);
  return m ? m.filePath : null;
}

export const pathOf = (id: number) => mediaRows.find((m) => m.id === id)?.filePath ?? '';
