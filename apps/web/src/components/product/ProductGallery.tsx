'use client';

// Gallery ảnh sản phẩm (WIREFRAME 2.3): ảnh lớn + phóng to + mũi tên + hàng thumbnail; thumbnail cuối là ô "3D"
import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import type { ProductImageView } from '@/types/api';

interface Props {
  images: ProductImageView[];
  name: string;
  active: number;
  onActive: (i: number) => void;
  /** Có mô hình 3D → hiện ô "3D" cuối hàng thumbnail */
  model3dHref?: string | null;
  discount?: number;
  /** Có ảnh 360° → badge 360° trên ảnh lớn và ô 360° cạnh ô 3D */
  href360?: string | null;
  onPrefetch360?: () => void;
}

export default function ProductGallery({
  images,
  name,
  active,
  onActive,
  model3dHref,
  discount,
  href360,
  onPrefetch360,
}: Props) {
  const [zoom, setZoom] = useState(false);
  const cur = images[active] ?? images[0];
  const go = (d: number) => onActive((active + d + images.length) % images.length);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface-muted">
        {cur && (
          <img src={cur.url} alt={`${name} – ảnh ${active + 1}`} className="h-full w-full object-cover" />
        )}
        {href360 && (
          <Link
            href={href360}
            onMouseEnter={onPrefetch360}
            onFocus={onPrefetch360}
            aria-label="Xem 360°"
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-[7px] border border-primary bg-white/95 px-2.5 py-1.5 text-xs font-bold text-primary shadow hover:bg-primary hover:text-white"
          >
            <Icon name="rotate" size={15} /> 360°
          </Link>
        )}
        {discount ? (
          <span
            className={cn(
              'absolute left-3 rounded bg-danger px-2 py-1 text-xs font-bold text-white',
              href360 ? 'top-14' : 'top-3',
            )}
          >
            -{discount}%
          </span>
        ) : null}
        <button
          type="button"
          aria-label="Phóng to ảnh"
          onClick={() => setZoom(true)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
        >
          <Icon name="expand" size={18} />
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              aria-label="Ảnh sau"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
            >
              <Icon name="chevronRight" />
            </button>
          </>
        )}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {images.map((im, i) => (
          <button
            key={im.id}
            type="button"
            aria-label={`Xem ảnh ${i + 1}`}
            aria-current={i === active}
            onClick={() => onActive(i)}
            className={cn(
              'h-16 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-surface-muted',
              i === active ? 'border-primary' : 'border-transparent hover:border-line',
            )}
          >
            <img src={im.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        {href360 && (
          <Link
            href={href360}
            onMouseEnter={onPrefetch360}
            onFocus={onPrefetch360}
            aria-label="Xem sản phẩm 360 độ"
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary-soft text-primary hover:bg-white"
          >
            <Icon name="rotate" size={22} />
            <span className="text-xs font-extrabold">360°</span>
          </Link>
        )}
        {model3dHref && (
          <Link
            href={model3dHref}
            aria-label="Xem mô hình 3D"
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary-soft text-primary hover:bg-white"
          >
            <Icon name="cube" size={22} />
            <span className="text-xs font-extrabold">3D</span>
          </Link>
        )}
      </div>
      <Modal open={zoom} onClose={() => setZoom(false)} title={name} width={980}>
        {cur && <img src={cur.url} alt={name} className="w-full rounded-md" />}
      </Modal>
    </div>
  );
}
