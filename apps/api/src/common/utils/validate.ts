// Kiểm tra dữ liệu đầu vào theo contract: thông báo tiếng Việt đúng từng trường như FE (mock) đang hiển thị.
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../exceptions/app.exception';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^0\d{9}$/;
/** Số điện thoại khi đăng ký (DAC_TA UC-AUTH-01): 10–11 chữ số, bắt đầu bằng 0 */
export const REGISTER_PHONE_RE = /^0\d{9,10}$/;

/** Chính sách mật khẩu (DAC_TA UC-AUTH-01/06, UC-ACC-02): ≥ 8 ký tự, có chữ hoa, chữ thường và chữ số */
export const PASSWORD_POLICY_MESSAGE = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.';
export function passwordPolicyError(pw: string): string | null {
  return pw.length >= 8 && /\p{Lu}/u.test(pw) && /\p{Ll}/u.test(pw) && /[0-9]/.test(pw)
    ? null
    : PASSWORD_POLICY_MESSAGE;
}
export const PASSWORD_CONFIRM_MESSAGE = 'Mật khẩu xác nhận không khớp.';

/** Ném VALIDATION_FAILED với details dạng { truong: ["thông báo"] } */
export function validationError(fields: Record<string, string>): AppException {
  return new AppException(
    ErrorCode.VALIDATION_FAILED,
    'Dữ liệu không hợp lệ.',
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])),
  );
}

/** 409 CONFLICT kèm details theo trường (dạng { truong: ["thông báo"] }) để form vẫn hiện lỗi dưới ô nhập */
export function conflictError(field: string, message: string): AppException {
  return new AppException(ErrorCode.CONFLICT, message, { [field]: [message] });
}

/** Lý do hủy đơn (DAC_TA UC-ORD-03, UC-ADM-22): bắt buộc, 5–500 ký tự; trả thông báo lỗi hoặc null */
export function cancelReasonError(reason: string): string | null {
  const n = reason.trim().length;
  return n >= 5 && n <= 500 ? null : 'Lý do hủy đơn từ 5 đến 500 ký tự.';
}

/** Thu thập lỗi rồi ném một lần nếu có */
export class FieldErrors {
  private readonly errs: Record<string, string> = {};

  add(field: string, message: string): this {
    if (!(field in this.errs)) this.errs[field] = message;
    return this;
  }

  /** Đã có lỗi chưa (để bỏ qua bước tốn kém như lưu ảnh khi dữ liệu còn sai) */
  any(): boolean {
    return Object.keys(this.errs).length > 0;
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
