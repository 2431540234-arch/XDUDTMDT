'use client';

// Trạng thái danh sách (tìm kiếm, lọc, sắp xếp, trang) dùng chung cho các trang admin
import { useCallback, useEffect, useState } from 'react';

export interface ListState {
  q: string;
  page: number;
  sort: string;
  [key: string]: string | number;
}

export function useListState<T extends ListState>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const patch = useCallback(
    (p: Partial<T>, resetPage = true) =>
      setState((s) => ({ ...s, ...p, ...(resetPage && !('page' in p) ? { page: 1 } : {}) })),
    [],
  );
  return [state, patch] as const;
}

/** Trì hoãn giá trị (ô tìm kiếm) để không gọi API mỗi lần gõ */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
