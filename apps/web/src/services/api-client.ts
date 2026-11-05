// Cấu hình HTTP client gốc dùng chung cho tất cả các service gọi API backend.
// Một điểm vào duy nhất: request(). Khi NEXT_PUBLIC_USE_MOCK=true, request được chuyển vào mock API chạy trong
// trình duyệt (apps/web/src/mock-data/mockApi); ngược lại gọi fetch tới `${NEXT_PUBLIC_API_URL}/api`.
// Giao diện không phải đổi gì khi bật/tắt mock.
import type { ApiResult, ErrorCode, PaginatedMeta } from '@aurelia-living/shared-types';
import { useAuthStore } from '@/store/authStore';

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

export const apiClient = {
  baseURL: `${baseUrl}/api`,
};

export class ApiClientError extends Error {
  constructor(
    public code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Lỗi theo từng trường (VALIDATION_FAILED) → { field: "thông báo đầu tiên" } */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.code === 'VALIDATION_FAILED' && this.details) {
      for (const [k, v] of Object.entries(this.details)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
    }
    return out;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined | Array<string | number>>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginatedMeta;
}

export function buildQueryString(query?: Query): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function rawRequest(
  method: string,
  path: string,
  opts: RequestOptions,
): Promise<{ status: number; body: ApiResult<unknown> }> {
  const token = useAuthStore.getState().accessToken;
  if (USE_MOCK) {
    const { handleMockRequest } = await import('@/mock-data/mockApi');
    return handleMockRequest({ method, path, query: opts.query ?? {}, body: opts.body, token });
  }
  let res: Response;
  try {
    res = await fetch(`${apiClient.baseURL}${path}${buildQueryString(opts.query)}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'Không kết nối được máy chủ. Vui lòng thử lại.', 0);
  }
  return { status: res.status, body: (await res.json()) as ApiResult<unknown> };
}

/** Gọi API, trả về { data, meta }. Ném ApiClientError nếu response không thành công. */
export async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<{ data: T; meta?: PaginatedMeta }> {
  const sentToken = useAuthStore.getState().accessToken;
  const { status, body } = await rawRequest(method, path, opts);
  if (!body.success) {
    // Token đã gửi bị từ chối (hết hạn/không hợp lệ) → đăng xuất cục bộ. Không xóa nếu yêu cầu được gửi
    // khi chưa có token (phiên đăng nhập đang được nạp từ localStorage).
    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      sentToken &&
      sentToken === useAuthStore.getState().accessToken
    ) {
      useAuthStore.getState().clear();
    }
    throw new ApiClientError(
      body.error.code,
      body.error.message,
      status,
      body.error.details as Record<string, unknown> | undefined,
    );
  }
  return { data: body.data as T, meta: body.meta };
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }).then((r) => r.data),
  list: <T>(path: string, query?: Query): Promise<Paginated<T>> =>
    request<T[]>('GET', path, { query }).then((r) => ({
      items: r.data,
      meta: r.meta ?? { page: 1, pageSize: r.data.length, total: r.data.length, totalPages: 1 },
    })),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }).then((r) => r.data),
  delete: <T = null>(path: string) => request<T>('DELETE', path).then((r) => r.data),
};
