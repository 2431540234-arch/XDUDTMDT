// Ảnh thật của dữ liệu mẫu: manifest khớp dữ liệu, có ảnh thì dùng đúng bộ, thiếu ảnh thì dùng ảnh minh họa.
// Không cần file ảnh nào trên đĩa (CI không có ảnh): danh sách file được giả lập qua NEXT_PUBLIC_MOCK_PHOTOS.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { photoManifest, productPhotos, spaceCoverPhoto } from '@/mock-data/utils/photos';

const allFiles = [
  ...Object.entries(photoManifest.products).flatMap(([slug, p]) =>
    p.photos.map((x) => `products/${slug}/${x.file}`),
  ),
  ...Object.entries(photoManifest.spaces).map(([slug, x]) => `spaces/${slug}/${x.file}`),
];

async function loadSeed(files: string[]) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_MOCK_PHOTOS', files.join(','));
  const { buildSeed } = await import('@/mock-data/db');
  return buildSeed();
}

type Seed = Awaited<ReturnType<typeof loadSeed>>;
const pathOfMedia = (db: Seed, id: number | null) => db.media.find((m) => m.id === id)?.filePath ?? '';
const imagesOf = (db: Seed, productId: number) =>
  db.productImages.filter((i) => i.productId === productId).sort((a, b) => a.sortOrder - b.sortOrder);

afterEach(() => vi.unstubAllEnvs());

describe('mock-data: ảnh thật', () => {
  it('mỗi slug trong manifest tồn tại; màu gắn cho ảnh là màu sản phẩm có', async () => {
    const db = await loadSeed([]);
    for (const [slug, entry] of Object.entries(photoManifest.products)) {
      const p = db.products.find((x) => x.slug === slug);
      expect(p, slug).toBeDefined();
      expect(entry.photos.length, slug).toBeGreaterThan(0);
      expect(entry.photos.length, slug).toBeLessThanOrEqual(6);
      const variantIds = new Set(db.productVariants.filter((v) => v.productId === p!.id).map((v) => v.id));
      const colors = new Set(
        db.variantAttributeValues
          .filter((x) => x.attributeCode === 'color' && variantIds.has(x.variantId))
          .map((x) => db.attributeValues.find((a) => a.id === x.attributeValueId)!.value),
      );
      for (const ph of entry.photos) if (ph.color) expect(colors, `${slug}: ${ph.color}`).toContain(ph.color);
    }
    for (const slug of Object.keys(photoManifest.spaces))
      expect(
        db.spaces.some((s) => s.slug === slug),
        slug,
      ).toBe(true);
  });

  it('không có ảnh thật → toàn bộ là ảnh minh họa', async () => {
    const db = await loadSeed([]);
    expect(db.media.some((m) => m.filePath.startsWith('/mock/photos/'))).toBe(false);
    for (const p of db.products) expect(imagesOf(db, p.id).length, p.slug).toBeGreaterThanOrEqual(4);
    for (const s of db.spaces) expect(pathOfMedia(db, s.coverMediaId)).toMatch(/^\/mock-img\/room/);
  });

  it('có đủ ảnh → đúng bộ ảnh, đúng thứ tự, ảnh màu gắn đúng biến thể; phần còn lại vẫn minh họa', async () => {
    const db = await loadSeed(allFiles);
    for (const p of db.products) {
      const imgs = imagesOf(db, p.id);
      const entry = photoManifest.products[p.slug];
      if (!entry) {
        for (const i of imgs) expect(pathOfMedia(db, i.mediaId), p.slug).toMatch(/^\/mock-img\/product/);
        continue;
      }
      expect(imgs.map((i) => pathOfMedia(db, i.mediaId))).toEqual(
        entry.photos.map((x) => `/mock/photos/products/${p.slug}/${x.file}`),
      );
      expect(imgs.filter((i) => i.isPrimary).map((i) => i.sortOrder)).toEqual([1]);
      imgs.forEach((img, k) => {
        const color = entry.photos[k].color;
        if (!color) return expect(img.variantId).toBeNull();
        const link = db.variantAttributeValues.find(
          (x) => x.variantId === img.variantId && x.attributeCode === 'color',
        )!;
        expect(db.attributeValues.find((a) => a.id === link.attributeValueId)!.value).toBe(color);
      });
    }
    for (const s of db.spaces) {
      const entry = photoManifest.spaces[s.slug];
      expect(pathOfMedia(db, s.coverMediaId)).toMatch(
        entry ? new RegExp(`^/mock/photos/spaces/${s.slug}/`) : /^\/mock-img\/room/,
      );
    }
    // ảnh 360° không đổi
    for (const pano of db.spacePanoramas) expect(pathOfMedia(db, pano.mediaId)).toMatch(/^\/mock-img\/pano/);
  });

  it('thiếu MỘT file của bộ → cả sản phẩm quay về ảnh minh họa, dữ liệu khác không đổi', async () => {
    const [slug, entry] = Object.entries(photoManifest.products)[0];
    const missing = `products/${slug}/${entry.photos[0].file}`;
    const files = new Set(allFiles.filter((f) => f !== missing));
    expect(productPhotos(slug, files)).toBeNull();
    expect(productPhotos(slug, new Set(allFiles))).toHaveLength(entry.photos.length);
    expect(spaceCoverPhoto('khong-co', new Set(allFiles))).toBeNull();
    // đổi ảnh không làm lệch dữ liệu sinh ngẫu nhiên (tên, tồn kho, đơn hàng)
    const a = await loadSeed([]);
    const b = await loadSeed(allFiles);
    for (const key of ['products', 'productVariants', 'orders', 'orderItems', 'spaceHotspots'] as const)
      expect(b[key], key).toEqual(a[key]);
  });
});
