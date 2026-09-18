// Store Zustand quản lý trạng thái giao diện chung (modal, sidebar, loading...)

import { create } from "zustand";

interface UIState {}

export const useUIStore = create<UIState>(() => ({}));
