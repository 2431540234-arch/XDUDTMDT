'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  count?: number;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export default function Tabs<K extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
}: TabsProps<K>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto',
        variant === 'underline' && 'border-b border-line',
        className,
      )}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cn(
              'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition',
              variant === 'underline'
                ? cn(
                    '-mb-px border-b-2',
                    active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink',
                  )
                : cn('rounded-btn', active ? 'bg-primary text-white' : 'text-muted hover:bg-surface-muted'),
            )}
          >
            {it.label}
            {it.count !== undefined && <span className="ml-1 opacity-80">({it.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
