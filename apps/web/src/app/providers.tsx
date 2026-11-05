'use client';

// Gắn các provider dùng chung cho toàn bộ ứng dụng: TanStack Query + Toaster (thông báo nổi).
import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import Toaster from '../components/ui/Toaster';
import { getQueryClient } from '../lib/query-client';

// Devtools chỉ nạp khi chạy dev; NODE_ENV được thay lúc build nên bản production loại bỏ hoàn toàn đoạn này
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools), {
        ssr: false,
      })
    : (_props: { client?: unknown; initialIsOpen?: boolean }) => null;

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
      {/* client truyền thẳng: tránh lỗi "No QueryClient set" khi devtools được nạp qua chunk riêng */}
      <ReactQueryDevtools client={queryClient} initialIsOpen={false} />
    </QueryClientProvider>
  );
}
