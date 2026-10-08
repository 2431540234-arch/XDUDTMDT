import { ERROR_HTTP_STATUS, type ErrorCode } from '@aurelia-living/shared-types';

/** Lỗi nghiệp vụ có mã lỗi chuẩn. HTTP status suy ra từ ERROR_HTTP_STATUS. */
export class AppException extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = ERROR_HTTP_STATUS[code];
  }
}
