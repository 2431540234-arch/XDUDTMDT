// Service gọi API liên quan đến xác thực (đăng nhập, đăng ký, quên/đặt lại/đổi mật khẩu)
import type { AuthTokens } from '@aurelia-living/shared-types';
import type { SessionUser } from '@/store/authStore';
import type { AddressView, UserView } from '@/types/api';
import { http } from './api-client';

export interface AuthResult {
  user: SessionUser;
  tokens: AuthTokens;
}

export const authApi = {
  login: (body: { email: string; password: string; adminOnly?: boolean }) =>
    http.post<AuthResult>('/auth/login', body),
  register: (body: { fullName: string; email: string; phone: string; password: string }) =>
    http.post<AuthResult>('/auth/register', body),
  logout: () => http.post<null>('/auth/logout'),
  /** BE gửi email chứa liên kết /reset-password?token=…; mock trả thêm devResetLink để thử không cần email */
  forgotPassword: (email: string) =>
    http.post<{ sent: true; devResetLink?: string }>('/auth/forgot-password', { email }),
  resetPassword: (body: { token: string; password: string }) => http.post<null>('/auth/reset-password', body),
  googleLogin: () => http.post<AuthResult>('/auth/google'), // TODO: chưa có trong BE – giả lập
};

export const userApi = {
  me: () => http.get<UserView>('/users/me'),
  update: (body: Partial<Pick<UserView, 'fullName' | 'phone' | 'gender' | 'birthday' | 'avatarUrl'>>) =>
    http.patch<UserView>('/users/me', body),
  changePassword: (body: { currentPassword: string; newPassword: string; logoutOthers?: boolean }) =>
    http.post<null>('/users/me/change-password', body),
};

export const addressApi = {
  list: () => http.get<AddressView[]>('/addresses'),
  create: (body: Partial<AddressView>) => http.post<AddressView>('/addresses', body),
  update: (id: number, body: Partial<AddressView>) => http.patch<AddressView>(`/addresses/${id}`, body),
  remove: (id: number) => http.delete(`/addresses/${id}`),
  setDefault: (id: number) => http.patch<AddressView>(`/addresses/${id}/default`),
};
