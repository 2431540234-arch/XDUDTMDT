// Store Zustand quản lý trạng thái viewer 3D/360° (góc nhìn, zoom, model đang chọn)

import { create } from "zustand";

interface ViewerState {}

export const useViewerStore = create<ViewerState>(() => ({}));
