'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import Icon from './Icon';

interface Props {
  value: number;
  count?: number;
  size?: number;
  /** Cho phép chọn sao (form đánh giá) */
  onChange?: (v: number) => void;
  showValue?: boolean;
  className?: string;
}

export default function StarRating({ value, count, size = 14, onChange, showValue, className }: Props) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="inline-flex" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} trên 5 sao`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= Math.round(shown);
          const star = (
            <Icon name="star" size={size} filled={on} className={on ? 'text-star' : 'text-line'} />
          );
          return onChange ? (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === value}
              aria-label={`${n} sao`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => onChange(n)}
            >
              {star}
            </button>
          ) : (
            <span key={n}>{star}</span>
          );
        })}
      </span>
      {showValue && <span className="text-sm font-semibold">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}
