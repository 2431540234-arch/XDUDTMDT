// Bảng `attribute_values`: Màu sắc, Kích thước, Chất liệu (loại thuộc tính là enum attribute_code, không còn bảng attributes)
import type { AttributeCode, AttributeValue } from '@aurelia-living/shared-types';

const at = '2026-01-02T08:00:00.000Z';

/** Ba loại thuộc tính (id giữ nguyên số cũ trong hợp đồng API) */
export const ATTRIBUTE_INFO: Record<AttributeCode, { id: number; name: string }> = {
  color: { id: 1, name: 'Màu sắc' },
  size: { id: 2, name: 'Kích thước' },
  material: { id: 3, name: 'Chất liệu' },
};

/** Màu: tên + mã hex (hex chưa có cột trong DB → giữ ở bảng riêng colorHex theo attributeValueId) */
export const COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Kem', hex: '#E8DCC8' },
  { name: 'Be', hex: '#D8C3A5' },
  { name: 'Trắng', hex: '#F5F5F0' },
  { name: 'Nâu', hex: '#7B5239' },
  { name: 'Đen', hex: '#2B2B2B' },
  { name: 'Xám', hex: '#8E8E8E' },
  { name: 'Xanh', hex: '#3F6B8F' },
  { name: 'Xanh rêu', hex: '#6B7D5C' },
  { name: 'Gỗ sồi', hex: '#C9A26B' },
  { name: 'Óc chó', hex: '#5C4033' },
];
export const SIZES = [
  '2 chỗ',
  '3 chỗ',
  '4 chỗ',
  '1m6',
  '1m8',
  '2m',
  '4 người',
  '6 người',
  '8 người',
  '2 cánh',
  '3 cánh',
  '4 cánh',
  '1m2',
  '1m4',
  '1m6 (bàn)',
  'Tiêu chuẩn',
  'Cỡ lớn',
  'Cao 1m2',
  'Cao 1m5',
];
export const MATERIALS = ['Vải', 'Da', 'Nỉ', 'Gỗ', 'Kim loại', 'Đá', 'Kính'];

export const attributeValues: AttributeValue[] = [];
/** attributeValueId của màu → mã hex (attribute_values.color_hex) */
export const colorHexByValueId: Record<number, string> = {};

const push = (attributeCode: AttributeCode, value: string) => {
  const id = attributeValues.length + 1;
  attributeValues.push({ id, attributeCode, value, createdAt: at, updatedAt: at });
  return id;
};
COLORS.forEach((c) => (colorHexByValueId[push('color', c.name)] = c.hex));
SIZES.forEach((s) => push('size', s));
MATERIALS.forEach((m) => push('material', m));

export const valueId = (attributeCode: AttributeCode, value: string): number => {
  const v = attributeValues.find((x) => x.attributeCode === attributeCode && x.value === value);
  if (!v) throw new Error(`Thiếu giá trị thuộc tính ${attributeCode}:${value}`);
  return v.id;
};
