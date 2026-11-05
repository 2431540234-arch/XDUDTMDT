// Bảng `attributes` và `attribute_values`: Màu sắc, Kích thước, Chất liệu
import type { Attribute, AttributeValue } from '@aurelia-living/shared-types';

const at = '2026-01-02T08:00:00.000Z';

export const attributes: Attribute[] = [
  { id: 1, code: 'color', name: 'Màu sắc', createdAt: at, updatedAt: at },
  { id: 2, code: 'size', name: 'Kích thước', createdAt: at, updatedAt: at },
  { id: 3, code: 'material', name: 'Chất liệu', createdAt: at, updatedAt: at },
];

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
/** attributeValueId của màu → mã hex  // TODO: chưa có trong DB */
export const colorHexByValueId: Record<number, string> = {};

const push = (attributeId: number, value: string) => {
  const id = attributeValues.length + 1;
  attributeValues.push({ id, attributeId, value, createdAt: at, updatedAt: at });
  return id;
};
COLORS.forEach((c) => (colorHexByValueId[push(1, c.name)] = c.hex));
SIZES.forEach((s) => push(2, s));
MATERIALS.forEach((m) => push(3, m));

export const valueId = (attributeId: number, value: string): number => {
  const v = attributeValues.find((x) => x.attributeId === attributeId && x.value === value);
  if (!v) throw new Error(`Thiếu giá trị thuộc tính ${attributeId}:${value}`);
  return v.id;
};
