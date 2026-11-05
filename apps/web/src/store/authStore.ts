// Store Zustand quản lý trạng thái xác thực người dùng (user, token). Lưu vào localStorage.
// Vai trò: 'admin' = Doanh nghiệp (Admin Panel), 'user' = Khách hàng (docs/DECISIONS D-P02).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@aurelia-living/shared-types';

export interface SessionUser extends AuthUser {
  avatarUrl: string | null;
  phone: string | null;
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** true sau khi đã đọc xong localStorage (tránh nhấp nháy/redirect sai khi hydrate) */
  hydrated: boolean;
  setSession: (user: SessionUser, accessToken: string, refreshToken: string) => void;
  patchUser: (patch: Partial<SessionUser>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      patchUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'aurelia-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

export const isAdmin = (u: SessionUser | null | undefined) => Boolean(u?.roles.includes('admin'));
