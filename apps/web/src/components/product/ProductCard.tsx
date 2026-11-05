'use client';

import Link from 'next/link';
import ColorSwatch from '@/components/ui/ColorSwatch';
import Icon from '@/components/ui/Icon';
import StarRating from '@/components/ui/StarRating';
import { useCartActions, useWishlist } from '@/hooks/useCart';
import { cn } from '@/lib/cn';
import { discountPercent, formatCurrency } from '@/lib/format';
import type { ProductListItem } from '@/types/api';

interface Props {
  product: ProductListItem;
  layout?: 'grid' | 'list';
  /** Bỏ nút thêm giỏ (thẻ nhỏ "đã xem gần đây") */
  compact?: boolean;
}

/** Thẻ sản phẩm (WIREFRAME 1.4): ảnh 4:3, tim, tên, sao, giá, swatch, nút thêm giỏ */
export default function ProductCard({ product: p, layout = 'grid', compact }: Props) {
  const wl = useWishlist();
  const { addToCart, adding } = useCartActions();
  const liked = wl.has(p.slug);
  const finalPrice = p.salePrice ?? p.price;
  const pct = discountPercent(finalPrice, p.salePrice ? p.price : null);
  const out = p.stockQuantity <= 0;

  return (
    <article
      className={cn('card group overflow-hidden transition hover:shadow-lg', layout === 'list' && 'flex')}
    >
      <div
        className={cn(
          'relative bg-surface-muted',
          layout === 'list' ? 'w-44 shrink-0 sm:w-56' : 'aspect-[4/3]',
        )}
      >
        <Link href={`/products/${p.slug}`} className="block h-full w-full" aria-label={p.name}>
          {p.thumbnailUrl ? (
            <img
              src={p.thumbnailUrl}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted">
              <Icon name="image" size={32} />
            </span>
          )}
        </Link>
        {pct > 0 && (
          <span className="absolute left-2 top-2 rounded bg-danger px-2 py-0.5 text-xs font-bold text-white">
            -{pct}%
          </span>
        )}
        {out && (
          <span className="absolute bottom-2 left-2 rounded bg-ink/80 px-2 py-0.5 text-xs font-semibold text-white">
            Tạm hết hàng
          </span>
        )}
        <button
          type="button"
          onClick={() => wl.toggle(p.slug)}
          aria-label={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          aria-pressed={liked}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow hover:scale-110"
        >
          <Icon name="heart" size={17} filled={liked} className={liked ? 'text-danger' : 'text-ink'} />
        </button>
      </div>
      <div className={cn('flex flex-1 flex-col p-3.5', layout === 'list' && 'justify-center p-5')}>
        <Link
          href={`/products/${p.slug}`}
          className="line-clamp-2 text-sm font-bold leading-snug hover:text-primary"
        >
          {p.name}
        </Link>
        <div className="mt-1.5">
          <StarRating value={p.ratingAvg} count={p.ratingCount} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-base font-extrabold', p.salePrice ? 'text-danger' : 'text-ink')}>
            {formatCurrency(finalPrice)}
          </span>
          {p.salePrice && <span className="text-xs text-muted line-through">{formatCurrency(p.price)}</span>}
        </div>
        {p.colors.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {p.colors.slice(0, 5).map((c) => (
              <ColorSwatch key={c.hex} hex={c.hex} name={c.name} />
            ))}
            {p.colors.length > 5 && <span className="text-xs text-muted">+{p.colors.length - 5}</span>}
          </div>
        )}
        {layout === 'list' && p.shortDescription && (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{p.shortDescription}</p>
        )}
        {!compact && (
          <button
            type="button"
            disabled={out || adding}
            onClick={() => addToCart(p.defaultVariantId, 1)}
            className={cn(
              'mt-3 flex items-center justify-center gap-2 rounded-btn border border-primary py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50',
              layout === 'list' && 'max-w-xs',
            )}
          >
            <Icon name="cart" size={16} /> Thêm vào giỏ hàng
          </button>
        )}
      </div>
    </article>
  );
}
