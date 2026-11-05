import type { ReactNode } from 'react';
import AccountLayout from '@/components/layout/AccountLayout';

export default function AccountGroupLayout({ children }: { children: ReactNode }) {
  return <AccountLayout>{children}</AccountLayout>;
}
