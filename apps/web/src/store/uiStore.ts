// Store Zustand quản lý trạng thái giao diện chung (modal, sidebar, loading...)

import { create } from "zustand";

interface UIState {
  searchQuery: string;
  toastMessage: string | null;
  setSearchQuery: (query: string) => void;
  showToast: (message: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  searchQuery: "",
  toastMessage: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 1800);
  },
}));
