// Store Zustand quản lý trạng thái xác thực người dùng (user, token)

import { create } from "zustand";

interface AuthState {}

export const useAuthStore = create<AuthState>(() => ({}));
