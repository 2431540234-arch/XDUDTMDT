// Các hàm/schema kiểm tra hợp lệ dữ liệu form phía client (thông báo lỗi tiếng Việt)
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { ApiClientError } from '@/services/api-client';

export const emailSchema = z.string().trim().min(1, 'Vui lòng nhập email.').email('Email không hợp lệ.');
/** Số điện thoại Việt Nam 10 số, bắt đầu bằng 0 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập số điện thoại.')
  .regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số.');
/** Số điện thoại khi đăng ký (DAC_TA UC-AUTH-01): tuỳ chọn, 10–11 chữ số bắt đầu bằng 0 */
export const registerPhoneSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^0\d{9,10}$/.test(v), 'Số điện thoại phải gồm 10–11 chữ số, bắt đầu bằng 0.');
/** Chính sách mật khẩu (DAC_TA UC-AUTH-01/06, UC-ACC-02): ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số */
export const PASSWORD_POLICY_MESSAGE = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.';
export const isStrongPassword = (v: string) =>
  v.length >= 8 && /\p{Lu}/u.test(v) && /\p{Ll}/u.test(v) && /[0-9]/.test(v);
export const passwordSchema = z
  .string()
  .min(1, 'Vui lòng nhập mật khẩu.')
  .refine(isStrongPassword, PASSWORD_POLICY_MESSAGE);
export const requiredText = (label: string, min = 1) =>
  z
    .string()
    .trim()
    .min(min, min > 1 ? `${label} tối thiểu ${min} ký tự.` : `Vui lòng nhập ${label.toLowerCase()}.`);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
  remember: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    fullName: requiredText('Họ và tên', 2),
    email: emailSchema,
    phone: registerPhoneSchema,
    password: passwordSchema,
    confirm: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
    agree: z.boolean().refine((v) => v, 'Bạn cần đồng ý với Điều khoản và Chính sách bảo mật.'),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Mật khẩu xác nhận không khớp.' });

export const addressSchema = z.object({
  label: z.string().trim().min(1, 'Vui lòng nhập tên gợi nhớ.'),
  recipientName: requiredText('Tên người nhận', 2),
  phone: phoneSchema,
  province: z.string().min(1, 'Vui lòng chọn tỉnh/thành.'),
  district: requiredText('Quận/huyện'),
  ward: requiredText('Phường/xã'),
  addressLine: requiredText('Số nhà, tên đường'),
  isDefault: z.boolean().optional(),
});

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Yếu' | 'Trung bình' | 'Mạnh' | 'Rất mạnh';
};

/** Thanh độ mạnh mật khẩu 4 vạch (WIREFRAME 7.4) */
export function passwordStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const label = score <= 1 ? 'Yếu' : score === 2 ? 'Trung bình' : score === 3 ? 'Mạnh' : 'Rất mạnh';
  return { score: score as PasswordStrength['score'], label };
}

/** Checklist yêu cầu mật khẩu (WIREFRAME 7.5) */
export function passwordChecks(pw: string, old = '') {
  return [
    { ok: pw.length >= 8, label: 'Tối thiểu 8 ký tự' },
    { ok: /\p{Lu}/u.test(pw), label: 'Có ít nhất 1 chữ hoa' },
    { ok: /\p{Ll}/u.test(pw), label: 'Có ít nhất 1 chữ thường' },
    { ok: /[0-9]/.test(pw), label: 'Có ít nhất 1 chữ số' },
    { ok: pw.length > 0 && pw !== old, label: 'Khác mật khẩu hiện tại' },
  ];
}

/** Gắn lỗi VALIDATION_FAILED của API vào form react-hook-form; trả về true nếu đã xử lý */
export function applyApiErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>): boolean {
  // 409 CONFLICT (slug/mã trùng) cũng kèm details theo trường nên hiện lỗi dưới ô nhập
  if (e instanceof ApiClientError && (e.code === 'VALIDATION_FAILED' || e.code === 'CONFLICT')) {
    if (Object.keys(e.fieldErrors()).length === 0) return false;
    for (const [k, msg] of Object.entries(e.fieldErrors())) setError(k as Path<T>, { message: msg });
    return true;
  }
  return false;
}

export function errorMessage(e: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.'): string {
  return e instanceof ApiClientError ? e.message : fallback;
}

/** Lý do hủy đơn (DAC_TA UC-ORD-03, UC-ADM-22): bắt buộc 5–500 ký tự; trả thông báo lỗi hoặc '' */
export function cancelReasonError(reason: string): string {
  const n = reason.trim().length;
  return n >= 5 && n <= 500 ? '' : 'Lý do hủy đơn từ 5 đến 500 ký tự.';
}
