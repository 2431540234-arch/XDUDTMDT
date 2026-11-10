import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * `false` ở máy chủ và ở lần render ĐẦU của client khi đang hydrate; `true` ngay sau đó (và `true` ngay lập tức khi component
 * được dựng bởi điều hướng phía client, không có hydrate). Dùng để lần render đầu của client LUÔN giống HTML máy chủ, bất kể
 * bộ nhớ đệm React Query đã có dữ liệu hay chưa (vd. Header nạp xong danh mục trước khi nội dung trong <Suspense> hydrate).
 * `useSyncExternalStore` với getServerSnapshot là cách React hỗ trợ chính thức; không cần useEffect nên không có khung hình thừa.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
