'use client';

import { cn } from '@/lib/cn';
import Icon from './Icon';

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

function pageList(page: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(total - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push('…');
  out.push(total);
  return out;
}

export default function Pagination({ page, totalPages, onChange, className }: Props) {
  if (totalPages <= 1) return null;
  const base = 'flex h-9 min-w-9 items-center justify-center rounded-btn border px-2 text-sm transition';
  return (
    <nav aria-label="Phân trang" className={cn('flex items-center justify-center gap-1.5', className)}>
      <button
        type="button"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={cn(base, 'border-line bg-white hover:bg-surface-muted disabled:opacity-40')}
      >
        <Icon name="chevronLeft" size={16} />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={cn(
              base,
              p === page
                ? 'border-primary bg-primary font-semibold text-white'
                : 'border-line bg-white hover:bg-surface-muted',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={cn(base, 'border-line bg-white hover:bg-surface-muted disabled:opacity-40')}
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}
