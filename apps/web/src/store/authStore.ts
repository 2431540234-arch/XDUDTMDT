// Store Zustand quản lý trạng thái xác thực người dùng (user, token)

import { create } from "zustand";
import { loginRequest, registerRequest } from "@/services/auth.api";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await loginRequest(email, password);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    // Đăng ký xong chưa đăng nhập ngay - người dùng cần đăng nhập lại, giống luồng bản tham khảo
    set({ isLoading: true, error: null });
    try {
      await registerRequest(name, email, password);
      set({ isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  logout: () => set({ user: null, isAuthenticated: false }),
}));
