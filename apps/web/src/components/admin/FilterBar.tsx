'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

interface FilterOption {
  value: string;
  label: string;
}
export interface FilterSelect {
  key: string;
  placeholder: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

interface Props {
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  selects?: FilterSelect[];
  /** Khoảng ngày (yyyy-mm-dd) */
  dateRange?: { from: string; to: string; onChange: (from: string, to: string) => void };
  actions?: ReactNode;
  className?: string;
}

/** Thanh công cụ trang danh sách admin: [tìm kiếm] [lọc 1] [lọc 2] [khoảng ngày] [+ Thêm …] */
export default function FilterBar({ search, selects, dateRange, actions, className }: Props) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-3', className)}>
      {search && (
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Icon
            name="search"
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="field pl-9"
          />
        </div>
      )}
      {selects?.map((s) => (
        <select
          key={s.key}
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
          aria-label={s.placeholder}
          className="field !w-auto min-w-[150px]"
        >
          <option value="">{s.placeholder}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {dateRange && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Từ ngày"
            value={dateRange.from}
            onChange={(e) => dateRange.onChange(e.target.value, dateRange.to)}
            className="field !w-auto"
          />
          <span className="text-muted">–</span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={dateRange.to}
            onChange={(e) => dateRange.onChange(dateRange.from, e.target.value)}
            className="field !w-auto"
          />
        </div>
      )}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
