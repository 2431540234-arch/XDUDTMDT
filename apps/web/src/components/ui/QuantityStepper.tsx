'use client';

import { cn } from '@/lib/cn';
import Icon from './Icon';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  className,
}: Props) {
  const btn = cn(
    'flex items-center justify-center text-ink transition hover:bg-surface-muted disabled:opacity-40',
    size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
  );
  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-btn border border-line bg-white',
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        aria-label="Giảm số lượng"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" size={14} />
      </button>
      <span
        className={cn(
          'min-w-[2.25rem] text-center text-sm font-semibold',
          size === 'sm' && 'min-w-[1.75rem]',
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label="Tăng số lượng"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}
