'use client';

// Form nhiều nhóm với menu tab dọc bên trái (WIREFRAME 3.0 – pattern trang thêm/sửa)
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FormTab<K extends string = string> {
  key: K;
  label: string;
  hasError?: boolean;
}

interface Props<K extends string> {
  tabs: FormTab<K>[];
  active: K;
  onChange: (k: K) => void;
  children: ReactNode;
}

export default function FormSection<K extends string>({ tabs, active, onChange, children }: Props<K>) {
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <nav className="card h-fit p-2" role="tablist" aria-orientation="vertical" aria-label="Nhóm thông tin">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            onClick={() => onChange(t.key)}
            className={cn(
              'flex w-full items-center justify-between rounded-btn px-3 py-2.5 text-left text-sm font-medium',
              t.key === active ? 'bg-surface-muted text-primary' : 'hover:bg-surface-muted/60',
            )}
          >
            {t.label}
            {t.hasError && <span className="h-2 w-2 rounded-full bg-danger" aria-label="Có lỗi" />}
          </button>
        ))}
      </nav>
      <div className="card p-5 sm:p-6">{children}</div>
    </div>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
