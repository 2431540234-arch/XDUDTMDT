// Tiện ích chọn biến thể (màu × kích thước) dùng chung cho trang chi tiết và trang Xem 360°
import { slugify } from './format';

export interface VariantLike {
  id: number;
  color: { name: string; hex: string } | null;
  size: string | null;
  stockQuantity: number;
  isActive?: boolean;
}

export const colorSlug = (name: string | null | undefined) => (name ? slugify(name) : '');
export const sizeSlug = (label: string | null | undefined) => (label ? slugify(label) : '');

/** Query đồng bộ giữa trang chi tiết và trang 360°: ?color=kem&size=3-cho */
export function variantQuery(color: string | null, size: string | null): string {
  const sp = new URLSearchParams();
  if (color) sp.set('color', colorSlug(color));
  if (size && size !== 'Tiêu chuẩn') sp.set('size', sizeSlug(size));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function findVariant<T extends VariantLike>(
  variants: T[],
  color: string | null,
  size: string | null,
): T | null {
  return variants.find((v) => (v.color?.name ?? null) === color && (v.size ?? null) === size) ?? null;
}

/** Danh sách kích thước theo thứ tự xuất hiện */
export function uniqueSizes<T extends VariantLike>(variants: T[]): string[] {
  const out: string[] = [];
  for (const v of variants) if (v.size && !out.includes(v.size)) out.push(v.size);
  return out;
}

export function uniqueColors<T extends VariantLike>(variants: T[]): Array<{ name: string; hex: string }> {
  const out: Array<{ name: string; hex: string }> = [];
  for (const v of variants) if (v.color && !out.some((c) => c.name === v.color!.name)) out.push(v.color);
  return out;
}

/** Kích thước còn hàng gần nhất (theo thứ tự) với kích thước mong muốn, cho một màu */
export function nearestInStockSize<T extends VariantLike>(
  variants: T[],
  color: string | null,
  wanted: string | null,
): string | null {
  const sizes = uniqueSizes(variants);
  const idx = Math.max(0, sizes.indexOf(wanted ?? ''));
  const ok = sizes
    .map((s, i) => ({ s, d: Math.abs(i - idx) }))
    .filter(({ s }) => (findVariant(variants, color, s)?.stockQuantity ?? 0) > 0)
    .sort((a, b) => a.d - b.d);
  return ok[0]?.s ?? null;
}

/** Đọc ?color=&size= (dạng slug) và trả về tên màu/kích thước khớp */
export function parseVariantQuery<T extends VariantLike>(
  variants: T[],
  search: string,
): { color: string | null; size: string | null } {
  const sp = new URLSearchParams(search);
  const c = sp.get('color');
  const s = sp.get('size');
  const color = c ? (uniqueColors(variants).find((x) => colorSlug(x.name) === c)?.name ?? null) : null;
  const size = s ? (uniqueSizes(variants).find((x) => sizeSlug(x) === s) ?? null) : null;
  return { color, size };
}
