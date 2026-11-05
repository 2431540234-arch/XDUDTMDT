'use client';

// Custom hook TanStack Query để xử lý xác thực người dùng + route guard
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authApi } from '@/services/auth.api';
import { isAdmin, useAuthStore } from '@/store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();

  return {
    user,
    hydrated,
    isLoggedIn: Boolean(user),
    isAdmin: isAdmin(user),
    logout: async () => {
      try {
        await authApi.logout();
      } catch {
        /* bỏ qua: vẫn xoá phiên cục bộ */
      }
      clear();
      qc.clear();
    },
  };
}

/** Guard cho khu khách hàng: chưa đăng nhập → /login?next=… */
export function useRequireCustomer() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (hydrated && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, pathname]);
  return { ready: hydrated && Boolean(user), user };
}

/** Guard cho /admin/*: phải là role 'admin' (Doanh nghiệp); khách hàng bị chuyển về trang chủ */
export function useRequireAdmin() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace('/admin/login');
    else if (!isAdmin(user)) router.replace('/');
  }, [hydrated, user, router]);
  return { ready: hydrated && isAdmin(user), user };
}
