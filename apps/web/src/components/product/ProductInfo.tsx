'use client';

// Khối thông tin bên phải trang chi tiết (WIREFRAME 2.3): giá, màu, kích thước, số lượng, nút mua, cam kết
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import ColorSwatch from '@/components/ui/ColorSwatch';
import Icon from '@/components/ui/Icon';
import QuantityStepper from '@/components/ui/QuantityStepper';
import StarRating from '@/components/ui/StarRating';
import { useCartActions, useWishlist } from '@/hooks/useCart';
import { cn } from '@/lib/cn';
import { discountPercent, formatCurrency } from '@/lib/format';
import { toast } from '@/store/uiStore';
import type { ProductDetail, VariantView } from '@/types/api';

interface Props {
  product: ProductDetail;
  color: string | null;
  size: string | null;
  onColor: (c: string) => void;
  onSize: (s: string) => void;
  variant: VariantView | null;
  onReviewsClick: () => void;
}

const promises = [
  { icon: 'truck', title: 'Giao hàng toàn quốc', text: '2–5 ngày' },
  { icon: 'refresh', title: 'Đổi trả dễ dàng', text: 'trong 7 ngày' },
  { icon: 'shield', title: 'Bảo hành chính hãng', text: '12 tháng' },
] as const;

export default function ProductInfo({
  product: p,
  color,
  size,
  onColor,
  onSize,
  variant,
  onReviewsClick,
}: Props) {
  const [qty, setQty] = useState(1);
  const router = useRouter();
  const { addToCart, adding } = useCartActions();
  const wl = useWishlist();
  const liked = wl.has(p.slug);
  const colors = p.colors;
  const sizes = p.sizes.filter((s) => s !== 'Tiêu chuẩn');
  const price = variant ? (variant.salePrice ?? variant.price) : (p.salePrice ?? p.price);
  const original = variant ? (variant.salePrice ? variant.price : null) : p.salePrice ? p.price : null;
  const pct = discountPercent(price, original);
  const stock = variant?.stockQuantity ?? 0;
  const sizeAvailable = (s: string) =>
    p.variants.some((v) => v.color?.name === color && v.size === s && v.stockQuantity > 0);

  const add = async () => {
    if (!variant) return toast.error('Vui lòng chọn đầy đủ màu sắc và kích thước.');
    return addToCart(variant.id, qty);
  };
  const buyNow = async () => {
    const cart = await add();
    const item = cart?.items.find((i) => i.variantId === variant?.id);
    if (item) router.push(`/checkout?items=${item.id}`);
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Đã sao chép liên kết sản phẩm.');
    } catch {
      toast.info(window.location.href);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{p.name}</h1>
      <button type="button" onClick={onReviewsClick} className="mt-2 flex items-center gap-2 text-sm">
        <StarRating value={p.ratingAvg} size={16} showValue />
        <span className="text-muted underline-offset-2 hover:underline">({p.ratingCount} đánh giá)</span>
      </button>
      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <span className={cn('text-3xl font-extrabold', original ? 'text-danger' : 'text-ink')}>
          {formatCurrency(price)}
        </span>
        {original && <span className="text-lg text-muted line-through">{formatCurrency(original)}</span>}
        {pct > 0 && (
          <span className="rounded bg-danger px-2 py-0.5 text-sm font-bold text-white">-{pct}%</span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{p.shortDescription}</p>

      {colors.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">
            Màu sắc: <span className="font-normal text-muted">{color}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => (
              <ColorSwatch
                key={c.name}
                hex={c.hex}
                name={c.name}
                size={30}
                selected={color === c.name}
                onClick={() => onColor(c.name)}
              />
            ))}
          </div>
        </div>
      )}
      {sizes.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Kích thước</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => onSize(s)}
                className={cn(
                  'rounded-btn border px-4 py-2 text-sm font-medium transition',
                  size === s
                    ? 'border-primary bg-primary text-white'
                    : 'border-line bg-white hover:border-primary',
                  !sizeAvailable(s) && size !== s && 'text-muted line-through',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Số lượng</p>
          <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, stock)} />
        </div>
        <p className={cn('mt-6 text-sm', stock > 0 ? 'text-emerald-600' : 'text-danger')}>
          {variant
            ? stock > 0
              ? stock <= 5
                ? `Chỉ còn ${stock} sản phẩm`
                : 'Còn hàng'
              : 'Tạm hết hàng'
            : ''}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          onClick={add}
          loading={adding}
          disabled={Boolean(variant) && stock <= 0}
        >
          <Icon name="cart" size={18} /> Thêm vào giỏ hàng
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={buyNow}
          disabled={Boolean(variant) && stock <= 0}
        >
          Mua ngay
        </Button>
      </div>

      <ul className="mt-6 grid grid-cols-3 gap-3 border-y border-line py-4">
        {promises.map((x) => (
          <li key={x.title} className="flex flex-col items-center gap-1 text-center text-xs">
            <Icon name={x.icon} size={22} className="text-primary" />
            <span className="font-semibold">{x.title}</span>
            <span className="text-muted">{x.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-6 text-sm">
        <button
          type="button"
          onClick={() => wl.toggle(p.slug)}
          className="flex items-center gap-2 font-medium hover:text-primary"
          aria-pressed={liked}
        >
          <Icon name="heart" size={18} filled={liked} className={liked ? 'text-danger' : ''} />{' '}
          {liked ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-2 font-medium hover:text-primary"
        >
          <Icon name="share" size={18} /> Chia sẻ
        </button>
      </div>
    </div>
  );
}
