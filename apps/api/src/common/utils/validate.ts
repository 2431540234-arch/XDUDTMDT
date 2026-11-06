// Kiểm tra dữ liệu đầu vào theo contract: thông báo tiếng Việt đúng từng trường như FE (mock) đang hiển thị.
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../exceptions/app.exception';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^0\d{9}$/;

/** Ném VALIDATION_FAILED với details dạng { truong: ["thông báo"] } */
export function validationError(fields: Record<string, string>): AppException {
  return new AppException(
    ErrorCode.VALIDATION_FAILED,
    'Dữ liệu không hợp lệ.',
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])),
  );
}

/** Thu thập lỗi rồi ném một lần nếu có */
export class FieldErrors {
  private readonly errs: Record<string, string> = {};

  add(field: string, message: string): this {
    if (!(field in this.errs)) this.errs[field] = message;
    return this;
  }

  throwIfAny(): void {
    if (Object.keys(this.errs).length) throw validationError(this.errs);
  }
}

export type Body = Record<string, unknown>;

/** Số nguyên dương hợp lệ từ đầu vào bất kỳ; không hợp lệ ⇒ 0 (id 0 không tồn tại nên truy vấn trả rỗng, không lỗi) */
export const toId = (v: unknown): number => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : 0;
};

export const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** Đọc body JSON dạng object, tránh null/mảng */
export function asBody(v: unknown): Body {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Body) : {};
}
