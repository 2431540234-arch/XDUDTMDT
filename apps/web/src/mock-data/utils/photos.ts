// Ảnh thật cho dữ liệu mẫu. Ảnh KHÔNG nằm trong git: mỗi máy tự chuyển bằng `npm run images:convert`.
// NEXT_PUBLIC_MOCK_PHOTOS = danh sách file đang có (next.config.js / seed-mock đặt); thiếu ⇒ dùng ảnh minh họa.
import manifest from '../photos/manifest.json';

export interface MockPhoto {
  url: string;
  fileName: string;
  /** màu (tên giá trị thuộc tính) mà ảnh thể hiện; bỏ trống = ảnh chung */
  color?: string;
}

export const photoManifest: {
  products: Record<string, { photos: Array<{ source: string; file: string; color?: string }> }>;
  spaces: Record<string, { source: string; file: string }>;
} = manifest;

const available = new Set((process.env.NEXT_PUBLIC_MOCK_PHOTOS ?? '').split(',').filter(Boolean));

const toPhoto = (rel: string, name: string, color?: string): MockPhoto => ({
  url: `/mock/photos/${rel}`,
  fileName: `${name}.webp`,
  ...(color ? { color } : {}),
});

/** Bộ ảnh thật của sản phẩm; null nếu không ghép ảnh hoặc máy thiếu BẤT KỲ file nào của bộ */
export function productPhotos(slug: string, files: Set<string> = available): MockPhoto[] | null {
  const entry = photoManifest.products[slug];
  if (!entry?.photos.length) return null;
  const rels = entry.photos.map((p) => `products/${slug}/${p.file}`);
  if (!rels.every((r) => files.has(r))) return null;
  return entry.photos.map((p, i) => toPhoto(rels[i], `${slug}-${i + 1}`, p.color));
}

/** Ảnh bìa thật của không gian mẫu; null nếu không ghép hoặc thiếu file */
export function spaceCoverPhoto(slug: string, files: Set<string> = available): MockPhoto | null {
  const entry = photoManifest.spaces[slug];
  if (!entry) return null;
  const rel = `spaces/${slug}/${entry.file}`;
  return files.has(rel) ? toPhoto(rel, `space-${slug}-cover`) : null;
}
