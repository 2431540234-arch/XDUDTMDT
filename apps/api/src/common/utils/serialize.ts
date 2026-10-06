// Tiện ích serialize dùng chung: đổi Prisma.Decimal (tiền, rating, yaw/pitch...) sang number
// trước khi trả về client. Quy ước chi tiết: docs/QUY_UOC_CODE_DB.md (mục 3).
import { Prisma } from '@prisma/client';

/** Decimal | number | string | null | undefined -> number | null */
export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  return Prisma.Decimal.isDecimal(value) ? (value as Prisma.Decimal).toNumber() : Number(value);
}

/** Như toNumber nhưng không bao giờ trả null (null/undefined -> 0). Dùng cho tổng tiền. */
export function toMoney(value: Prisma.Decimal | number | string | null | undefined): number {
  return toNumber(value) ?? 0;
}

/**
 * Duyệt đệ quy object/mảng kết quả Prisma và đổi MỌI Prisma.Decimal thành number.
 * Giữ nguyên Date, Buffer, null và kiểu nguyên thủy; không sửa object gốc.
 * Gọi ở tầng controller/interceptor trước khi trả response (JSON.stringify mặc định biến Decimal thành string).
 */
export function serialize<T>(input: T): Serialized<T> {
  return walk(input) as Serialized<T>;
}

function walk(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toNumber();
  if (Array.isArray(v)) return v.map(walk);
  if (v instanceof Date || Buffer.isBuffer(v)) return v;
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
    return out;
  }
  return v;
}

/** Kiểu kết quả: Decimal -> number ở mọi cấp. */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date | Buffer
    ? T
    : T extends Array<infer U>
      ? Array<Serialized<U>>
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;
