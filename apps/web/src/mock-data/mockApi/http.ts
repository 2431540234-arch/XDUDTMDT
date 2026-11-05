// Kiểu và tiện ích chung của mock API: lỗi, phân trang, đọc query/body
import type { ErrorCode, PaginatedMeta } from '@aurelia-living/shared-types';
import type { Db } from '../db';

export class ApiFail extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const validation = (fields: Record<string, string>) =>
  new ApiFail(
    'VALIDATION_FAILED',
    'Dữ liệu không hợp lệ.',
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])),
  );
export const notFound = (what = 'Dữ liệu') => new ApiFail('RESOURCE_NOT_FOUND', `${what} không tồn tại.`);

export type Query = Record<string, string | number | boolean | null | undefined | Array<string | number>>;
export type DbUser = Db['users'][number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Body = Record<string, any>;

export interface Ctx {
  db: Db;
  user: DbUser | null;
  params: Record<string, string>;
  query: Query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export interface Result {
  data: unknown;
  meta?: PaginatedMeta;
  status?: number;
}

export const ok = (data: unknown, status = 200): Result => ({ data, status });
export const created = (data: unknown): Result => ({ data, status: 201 });
export const done = (): Result => ({ data: null });

export const qStr = (q: Query, k: string): string => {
  const v = q[k];
  return v === undefined || v === null ? '' : Array.isArray(v) ? v.join(',') : String(v);
};
export const qNum = (q: Query, k: string, d: number): number => {
  const n = Number(q[k]);
  return Number.isFinite(n) && q[k] !== undefined && q[k] !== '' ? n : d;
};
export const qList = (q: Query, k: string): string[] =>
  qStr(q, k)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
export const qBool = (q: Query, k: string): boolean | undefined =>
  q[k] === undefined || q[k] === '' ? undefined : String(q[k]) === 'true';

export function paginate<T>(items: T[], q: Query, defaultSize = 20): Result {
  const pageSize = Math.min(100, Math.max(1, qNum(q, 'pageSize', defaultSize)));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, qNum(q, 'page', 1)), totalPages);
  return {
    data: items.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total, totalPages },
  };
}

/** Sắp xếp theo `sort=truong:asc|desc` với danh sách trường được phép (whitelist) */
export function sortBy<T>(
  items: T[],
  sort: string,
  getters: Record<string, (x: T) => string | number | null>,
  fallback?: string,
): T[] {
  const [field, dir] = (sort || fallback || '').split(':');
  const get = getters[field];
  if (!get) return items;
  const mul = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x < y ? -1 : 1) * mul;
  });
}

/** Bỏ dấu tiếng Việt, chữ thường – dùng cho tìm kiếm không dấu (UC-CAT-06) */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export const nowIso = () => new Date().toISOString();

export function inRange(iso: string, from?: string, to?: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}
