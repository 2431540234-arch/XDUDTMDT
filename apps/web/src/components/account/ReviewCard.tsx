'use client';

import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import StarRating from '@/components/ui/StarRating';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/format';
import { reviewStatusInfo } from '@/lib/status';
import type { ReviewView } from '@/types/api';

interface Props {
  review: ReviewView;
  /** 'mine': thẻ trong "Đánh giá của tôi" (ảnh SP + sửa); 'public': đánh giá hiển thị ở trang chi tiết SP */
  mode?: 'mine' | 'public';
  onEdit?: (r: ReviewView) => void;
}

/** Thẻ đánh giá (WIREFRAME 2.11) */
export default function ReviewCard({ review: r, mode = 'public', onEdit }: Props) {
  const imgs = r.images.slice(0, 3);
  const extra = r.images.length - imgs.length;
  return (
    <article className="card flex gap-4 p-5">
      {mode === 'mine' && (
        <Link
          href={`/products/${r.productSlug}`}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface-muted"
        >
          {r.productImageUrl && (
            <img src={r.productImageUrl} alt={r.productName} className="h-full w-full object-cover" />
          )}
        </Link>
      )}
      {mode === 'public' && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
          {r.userName.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {mode === 'mine' ? (
              <Link href={`/products/${r.productSlug}`} className="font-bold hover:text-primary">
                {r.productName}
              </Link>
            ) : (
              <p className="font-semibold">{r.userName}</p>
            )}
            <p className="text-xs text-muted">
              {mode === 'mine' && r.purchasedAt
                ? `Đã mua ngày ${formatDate(r.purchasedAt)}`
                : formatDate(r.createdAt)}
              {mode === 'public' && r.variantLabel ? ` · ${r.variantLabel}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {mode === 'mine' && <StatusBadge info={reviewStatusInfo[r.status]} />}
            {mode === 'mine' && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(r)}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Icon name="edit" size={15} /> Sửa đánh giá
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5">
          <StarRating value={r.rating} size={15} />
        </div>
        {r.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted">
                {t}
              </span>
            ))}
          </div>
        )}
        {r.content && <p className="mt-2 text-sm leading-relaxed">{r.content}</p>}
        {imgs.length > 0 && (
          <div className="mt-3 flex gap-2">
            {imgs.map((src, i) => (
              <div key={src + i} className="relative h-16 w-16 overflow-hidden rounded-md bg-surface-muted">
                <img src={src} alt={`Ảnh đánh giá ${i + 1}`} className="h-full w-full object-cover" />
                {i === imgs.length - 1 && extra > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-bold text-white">
                    +{extra}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
