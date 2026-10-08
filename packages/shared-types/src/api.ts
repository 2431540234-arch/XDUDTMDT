// Kiểu response chuẩn của API. Quy ước chi tiết: docs/API_CONVENTIONS.md (mục 2, 3).
import type { ErrorCode } from './error-codes';

/** Siêu dữ liệu phân trang (chỉ có ở response danh sách). */
export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Response thành công. `meta` chỉ có khi response là danh sách phân trang. */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginatedMeta;
}

/** Lỗi theo từng trường khi validate thất bại: { tenTruong: ["thông báo 1", ...] } */
export type ValidationDetails = Record<string, string[]>;

export interface ApiErrorBody {
  code: ErrorCode;
  /** Thông báo tiếng Việt, có thể hiển thị trực tiếp cho người dùng. */
  message: string;
  /** Chi tiết bổ sung: lỗi theo trường (VALIDATION_FAILED) hoặc dữ liệu ngữ cảnh. */
  details?: ValidationDetails | Record<string, unknown>;
}

/** Response lỗi. */
export interface ApiError {
  success: false;
  error: ApiErrorBody;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

/** Tham số phân trang, sắp xếp chung qua query string. */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  /** Ví dụ: "createdAt:desc" hoặc "price:asc". */
  sort?: string;
}
