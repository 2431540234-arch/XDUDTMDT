// Store Zustand quản lý trạng thái giỏ hàng

import { create } from "zustand";

interface CartState {}

export const useCartStore = create<CartState>(() => ({}));
