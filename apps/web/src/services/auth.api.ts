// Service gọi API liên quan đến xác thực (đăng nhập, đăng ký, quên/đặt lại/đổi mật khẩu)
import type { AuthTokens } from '@aurelia-living/shared-types';
import { useAuthStore, type SessionUser } from '@/store/authStore';
import type { AddressView, SessionView, UserView } from '@/types/api';
import { http, request } from './api-client';

export interface AuthResult {
  user: SessionUser;
  tokens: AuthTokens;
}

export const authApi = {
  login: (body: { email: string; password: string; adminOnly?: boolean }) =>
    http.post<AuthResult>('/auth/login', body),
  register: (body: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    confirmPassword: string;
  }) => http.post<AuthResult>('/auth/register', body),
  logout: () => http.post<null>('/auth/logout', { refreshToken: useAuthStore.getState().refreshToken }),
  /** BE gửi email chứa liên kết /reset-password?token=…; mock trả thêm devResetLink để thử không cần email */
  forgotPassword: (email: string) =>
    http.post<{ sent: true; devResetLink?: string }>('/auth/forgot-password', { email }),
  resetPassword: (body: { token: string; newPassword: string; confirmPassword: string }) =>
    http.post<null>('/auth/reset-password', body),
  /** Xác thực email bằng token trong liên kết (JWT verify_email) */
  verifyEmail: (token: string) => http.post<{ verified: true }>('/auth/verify-email', { token }),
  /** Gửi lại email xác thực cho tài khoản đang đăng nhập (cách nhau 60 giây) */
  resendVerification: () =>
    http.post<{ sent: boolean; verified: boolean; devVerifyLink?: string }>('/auth/resend-verification'),
  googleLogin: () => http.post<AuthResult>('/auth/google'), // TODO: chưa có trong BE – giả lập
};

export const userApi = {
  me: () => http.get<UserView>('/users/me'),
  update: (body: Partial<Pick<UserView, 'fullName' | 'phone' | 'gender' | 'birthday' | 'avatarUrl'>>) =>
    http.patch<UserView>('/users/me', body),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    logoutOthers?: boolean;
  }) => http.post<null>('/users/me/change-password', body),
  /** UC-ACC-03: phiên đăng nhập còn hiệu lực; current = thiết bị này */
  sessions: () => http.get<SessionView[]>('/users/me/sessions'),
  revokeSession: (id: number) => http.delete(`/users/me/sessions/${id}`),
  /** UC-ACC-07: xóa tài khoản (xóa mềm), cần mật khẩu xác nhận; 409 nếu còn đơn đang xử lý */
  deleteAccount: (password: string) =>
    request<null>('DELETE', '/users/me', { body: { password } }).then((r) => r.data),
};

export const addressApi = {
  list: () => http.get<AddressView[]>('/addresses'),
  create: (body: Partial<AddressView>) => http.post<AddressView>('/addresses', body),
  update: (id: number, body: Partial<AddressView>) => http.patch<AddressView>(`/addresses/${id}`, body),
  remove: (id: number) => http.delete(`/addresses/${id}`),
  setDefault: (id: number) => http.patch<AddressView>(`/addresses/${id}/default`),
};
