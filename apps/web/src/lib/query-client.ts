// Khởi tạo QueryClient dùng chung cho TanStack Query.
// Trên server mỗi request nên có client riêng (tránh lẫn dữ liệu giữa người dùng); trên trình duyệt dùng một client duy nhất.
import { QueryClient, isServer } from '@tanstack/react-query';
import { makeWriteSafe } from './query-refresh';

export function makeQueryClient() {
  // makeWriteSafe: ghi xong (invalidate/setQueryData) không bị lần tải cũ đang bay ghi đè, xem query-refresh.ts
  return makeWriteSafe(
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000, // dữ liệu công khai coi là mới trong 1 phút
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
