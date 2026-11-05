import type { ReactNode } from 'react';
import StoreLayout from '@/components/layout/StoreLayout';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <StoreLayout>{children}</StoreLayout>;
}
