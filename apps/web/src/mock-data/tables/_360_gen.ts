// Dữ liệu "Xem 360°": product_360 (cấu hình) và product_360_frames (chuỗi ảnh theo màu).
// TODO: cần thêm vào DB/API (chưa có bảng tương ứng) – xem docs/FE_PROGRESS.md (đề xuất DB/API).
// Ảnh frame sinh bằng apps/web/scripts/gen-mock-360.mjs → public/mock/360/<product-slug>/<color-slug>/frame-01..36.svg
import cfg from '../../../scripts/mock-360-products.json';
import { slugify } from '@/lib/format';
import { valueId } from './attributes';
import { products } from './_products_gen';

export interface Product360 {
  productId: number;
  enabled: boolean;
  frameCount: number; // 24 hoặc 36
  defaultColorId: number; // attribute_values.id của màu mặc định
  autoRotate: boolean;
  rotationSpeed: number; // frame/giây khi tự xoay
}

export interface Product360Frames {
  productId: number;
  colorId: number; // attribute_values.id (attributeId = 1: màu)
  colorName: string;
  colorHex: string;
  /** URL ảnh theo thứ tự góc 0° → 350° */
  frames: string[];
  thumbnail: string;
  /** Ảnh riêng theo kích thước (tùy chọn) – hiện không dùng */
  sizeId?: number | null;
}

export const product360: Product360[] = [];
export const product360Frames: Product360Frames[] = [];

for (const item of cfg.products) {
  const p = products.find((x) => x.name === item.name);
  if (!p) throw new Error(`Thiếu sản phẩm cho 360°: ${item.name}`);
  const pslug = slugify(item.name);
  product360.push({
    productId: p.id,
    enabled: true,
    frameCount: cfg.frameCount,
    defaultColorId: valueId(1, item.defaultColor),
    autoRotate: true,
    rotationSpeed: 8,
  });
  for (const color of item.colors) {
    const frames = Array.from(
      { length: cfg.frameCount },
      (_, i) => `/mock/360/${pslug}/${slugify(color)}/frame-${String(i + 1).padStart(2, '0')}.svg`,
    );
    product360Frames.push({
      productId: p.id,
      colorId: valueId(1, color),
      colorName: color,
      colorHex: (cfg.colors as Record<string, string>)[color],
      frames,
      thumbnail: frames[0],
    });
  }
}
