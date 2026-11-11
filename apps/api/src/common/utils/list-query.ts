// Đọc tham số danh sách theo contract: page, pageSize, sort=truong:asc|desc, danh sách phân tách bằng dấu phẩy.
export type RawQuery = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export const qStr = (q: RawQuery, k: string): string => (first(q[k]) ?? '').trim();
export const qNum = (q: RawQuery, k: string, d: number): number => {
  const raw = first(q[k]);
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) ? n : d;
};
export const qBool = (q: RawQuery, k: string): boolean | undefined => {
  const v = first(q[k]);
  return v === undefined || v === '' ? undefined : v === 'true';
};
export const qList = (q: RawQuery, k: string): string[] =>
  (q[k] === undefined ? [] : [Array.isArray(q[k]) ? (q[k] as string[]).join(',') : (q[k] as string)])
    .join(',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export interface PageInfo {
  page: number;
  pageSize: number;
  skip: number;
}

/** pageSize mặc định theo từng danh sách, tối đa 100 (giống mock) */
export function pageInfo(q: RawQuery, defaultSize = 20): { page: number; pageSize: number } {
  const pageSize = Math.min(100, Math.max(1, qNum(q, 'pageSize', defaultSize)));
  return { page: Math.max(1, qNum(q, 'page', 1)), pageSize };
}

/** Kẹp page vào [1, totalPages] như mock rồi tính skip */
export function resolvePage(q: RawQuery, total: number, defaultSize = 20): PageInfo {
  const { page, pageSize } = pageInfo(q, defaultSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, totalPages);
  return { page: p, pageSize, skip: (p - 1) * pageSize };
}

/** sort=truong:asc → [truong, 'asc'] nếu truong thuộc whitelist */
export function parseSort(sort: string, allowed: string[]): { field: string; dir: 'asc' | 'desc' } | null {
  const [field, dir] = sort.split(':');
  if (!field || !allowed.includes(field)) return null;
  return { field, dir: dir === 'desc' ? 'desc' : 'asc' };
}
