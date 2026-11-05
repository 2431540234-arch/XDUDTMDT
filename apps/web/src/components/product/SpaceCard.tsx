'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';
import { roomTypeLabel } from '@/lib/status';
import { spaceApi } from '@/services/space.api';
import { toast } from '@/store/uiStore';
import type { SpaceListItem } from '@/types/api';

/** Thẻ không gian mẫu: ảnh, ♡ lưu, tên, "N sản phẩm". `featured` = overlay + nút → tròn (WIREFRAME 2.14) */
export default function SpaceCard({
  space: s,
  featured,
  layout = 'grid',
}: {
  space: SpaceListItem;
  featured?: boolean;
  layout?: 'grid' | 'list';
}) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => (s.isBookmarked ? spaceApi.unbookmark(s.slug) : spaceApi.bookmark(s.slug)),
    onSuccess: () => {
      toast.success(s.isBookmarked ? 'Đã bỏ lưu không gian.' : 'Đã lưu không gian mẫu.');
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['space', s.slug] });
    },
  });
  const onHeart = () => {
    if (!user) {
      toast.info('Vui lòng đăng nhập để lưu không gian mẫu.');
      router.push('/login?next=/spaces');
      return;
    }
    toggle.mutate();
  };
  return (
    <article className={cn('card group overflow-hidden', layout === 'list' && 'flex')}>
      <div
        className={cn(
          'relative bg-surface-muted',
          layout === 'list' ? 'w-56 shrink-0' : featured ? 'aspect-[4/3]' : 'aspect-[4/3]',
        )}
      >
        <Link href={`/spaces/${s.slug}`} className="block h-full" aria-label={s.title}>
          {s.coverUrl && (
            <img
              src={s.coverUrl}
              alt={s.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
            />
          )}
          {featured && (
            <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
          )}
        </Link>
        <button
          type="button"
          onClick={onHeart}
          aria-label={s.isBookmarked ? 'Bỏ lưu' : 'Lưu không gian'}
          aria-pressed={s.isBookmarked}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow hover:scale-110"
        >
          <Icon
            name="heart"
            size={17}
            filled={s.isBookmarked}
            className={s.isBookmarked ? 'text-danger' : ''}
          />
        </button>
        {featured && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
            <div>
              <p className="font-bold">{s.title}</p>
              <p className="text-xs text-white/85">{s.productCount} sản phẩm</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary">
              <Icon name="arrowRight" size={16} />
            </span>
          </div>
        )}
      </div>
      {!featured && (
        <div className={cn('p-3.5', layout === 'list' && 'flex flex-1 flex-col justify-center p-5')}>
          <Link href={`/spaces/${s.slug}`} className="line-clamp-1 font-bold hover:text-primary">
            {s.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted">
            {s.productCount} sản phẩm · {roomTypeLabel[s.roomType]}
            {s.style ? ` · ${s.style}` : ''}
          </p>
          {layout === 'list' && <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>}
        </div>
      )}
    </article>
  );
}
