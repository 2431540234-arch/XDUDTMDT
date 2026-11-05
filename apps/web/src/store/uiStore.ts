// Store Zustand quản lý trạng thái giao diện chung (toast, drawer, sidebar admin...)

import { create } from 'zustand';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface UIState {
  toasts: ToastItem[];
  adminSidebarOpen: boolean;
  filterDrawerOpen: boolean;
  pushToast: (type: ToastItem['type'], message: string) => void;
  dismissToast: (id: number) => void;
  setAdminSidebarOpen: (open: boolean) => void;
  setFilterDrawerOpen: (open: boolean) => void;
}

let seq = 1;

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  adminSidebarOpen: false,
  filterDrawerOpen: false,
  pushToast: (type, message) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAdminSidebarOpen: (open) => set({ adminSidebarOpen: open }),
  setFilterDrawerOpen: (open) => set({ filterDrawerOpen: open }),
}));

/** Gọi toast từ bất kỳ đâu (kể cả ngoài component) */
export const toast = {
  success: (m: string) => useUIStore.getState().pushToast('success', m),
  error: (m: string) => useUIStore.getState().pushToast('error', m),
  info: (m: string) => useUIStore.getState().pushToast('info', m),
};
