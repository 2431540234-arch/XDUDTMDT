// Store Zustand quản lý trạng thái giỏ hàng

import { create } from "zustand";

interface CartLine {
  productId: string;
  quantity: number;
}

interface CartState {
  items: CartLine[];
  count: number;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

function computeCount(items: CartLine[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  count: 0,

  addItem: (productId, quantity = 1) => {
    const existing = get().items.find((i) => i.productId === productId);
    const items = existing
      ? get().items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i))
      : [...get().items, { productId, quantity }];
    set({ items, count: computeCount(items) });
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.productId !== productId);
    set({ items, count: computeCount(items) });
  },

  clear: () => set({ items: [], count: 0 }),
}));
