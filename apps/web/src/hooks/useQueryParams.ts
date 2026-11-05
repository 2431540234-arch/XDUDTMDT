'use client';

// Đọc/ghi tham số trên URL (bộ lọc, trang, sắp xếp) để trang danh sách chia sẻ/quay lại được
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function useQueryParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback((k: string, d = '') => sp.get(k) ?? d, [sp]);
  const getList = useCallback((k: string) => (sp.get(k) ?? '').split(',').filter(Boolean), [sp]);
  const getNum = useCallback(
    (k: string, d: number) => (sp.get(k) && Number.isFinite(Number(sp.get(k))) ? Number(sp.get(k)) : d),
    [sp],
  );

  const set = useCallback(
    (
      patch: Record<string, string | number | string[] | null | undefined>,
      opts: { keepPage?: boolean } = {},
    ) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
        else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
      if (!opts.keepPage && !('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  return { get, getList, getNum, set };
}
