'use client';

// Modal viết/sửa đánh giá (WIREFRAME 7.8)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Checkbox, Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StarRating from '@/components/ui/StarRating';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/validators';
import { myReviewApi } from '@/services/cart.api';
import { productApi } from '@/services/product.api';
import { toast } from '@/store/uiStore';
import type { OrderView, ReviewView } from '@/types/api';

const LABELS = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Hài lòng', 'Tuyệt vời'];
const CHIPS = ['Chất lượng tốt', 'Đúng mô tả', 'Giao hàng nhanh', 'Đóng gói cẩn thận', 'Giá hợp lý'];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Viết đánh giá mới cho đơn đã giao */
  order?: OrderView | null;
  /** Sửa đánh giá đã có */
  review?: ReviewView | null;
}

export default function ReviewModal({ open, onClose, order, review }: Props) {
  const qc = useQueryClient();
  const items = (order?.items ?? []).filter((i) => i.productSlug && !i.reviewed);
  const [slug, setSlug] = useState('');
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [anon, setAnon] = useState(false);
  const [err, setErr] = useState<{ rating?: string; content?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErr({});
    if (review) {
      setRating(review.rating);
      setTags(review.tags);
      setContent(review.content ?? '');
      setImages(review.images);
      setAnon(false);
    } else {
      setRating(0);
      setTags([]);
      setContent('');
      setImages([]);
      setAnon(false);
      setSlug(items[0]?.productSlug ?? '');
    }
  }, [open, review, order?.id]);

  const target = review
    ? {
        name: review.productName,
        img: review.productImageUrl,
        variant: review.variantLabel,
        code: review.orderCode,
      }
    : (() => {
        const it = items.find((i) => i.productSlug === slug);
        return it
          ? {
              name: it.productName,
              img: it.imageUrl,
              variant: it.variantLabel,
              code: order?.orderCode ?? null,
            }
          : null;
      })();

  const save = useMutation({
    mutationFn: () =>
      review
        ? myReviewApi.update(review.id, { rating, content, tags })
        : productApi.createReview(slug, {
            orderId: order!.id,
            rating,
            content,
            tags,
            images,
            anonymous: anon,
          }),
    onSuccess: () => {
      toast.success(
        review
          ? 'Đã cập nhật đánh giá. Đánh giá sẽ hiển thị sau khi được duyệt.'
          : 'Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi được duyệt.',
      );
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
      qc.invalidateQueries({ queryKey: ['order'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    const x: typeof err = {};
    if (!rating) x.rating = 'Vui lòng chọn số sao.';
    if (content.trim().length < 20) x.content = 'Nội dung đánh giá tối thiểu 20 ký tự.';
    setErr(x);
    if (!Object.keys(x).length) save.mutate();
  };
  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const room = 5 - images.length;
    const picked = Array.from(files)
      .slice(0, room)
      .filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (picked.length < Math.min(files.length, room)) toast.error('Chỉ nhận ảnh dưới 5MB.');
    setImages([...images, ...(await Promise.all(picked.map(readAsDataUrl)))]);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={review ? 'Sửa đánh giá' : 'Đánh giá sản phẩm'}
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit} disabled={!review && !items.length}>
            Gửi đánh giá
          </Button>
        </>
      }
    >
      {!review && !items.length ? (
        <p className="py-6 text-center text-sm text-muted">
          Bạn đã đánh giá tất cả sản phẩm trong đơn hàng này.
        </p>
      ) : (
        <div className="space-y-5">
          {!review && items.length > 1 && (
            <Select
              label="Sản phẩm cần đánh giá"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              options={items.map((i) => ({ value: i.productSlug!, label: i.productName }))}
            />
          )}
          {target && (
            <div className="flex items-center gap-3 rounded-card bg-surface-muted/60 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white">
                {target.img && <img src={target.img} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="text-sm">
                <p className="font-semibold">{target.name}</p>
                <p className="text-xs text-muted">Phân loại: {target.variant}</p>
                {target.code && <p className="text-xs text-muted">Đơn hàng #{target.code}</p>}
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="flex justify-center">
              <StarRating
                value={rating}
                size={36}
                onChange={(v) => {
                  setRating(v);
                  setErr((e) => ({ ...e, rating: undefined }));
                }}
              />
            </div>
            <p className={cn('mt-1 h-5 text-sm font-semibold', rating >= 4 ? 'text-primary' : 'text-muted')}>
              {LABELS[rating]}
            </p>
            {err.rating && (
              <p role="alert" className="text-xs text-danger">
                {err.rating}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Điều bạn hài lòng</p>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={tags.includes(c)}
                  onClick={() => setTags((t) => (t.includes(c) ? t.filter((x) => x !== c) : [...t, c]))}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium',
                    tags.includes(c)
                      ? 'border-primary bg-primary text-white'
                      : 'border-line hover:border-primary',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="review-content" className="mb-1.5 block text-sm font-medium">
              Nội dung đánh giá <span className="text-danger">*</span>
            </label>
            <textarea
              id="review-content"
              rows={4}
              maxLength={1000}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErr((x) => ({ ...x, content: undefined }));
              }}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm (tối thiểu 20 ký tự)…"
              className={cn('field resize-y', err.content && 'field-error')}
            />
            <div className="mt-1 flex justify-between text-xs">
              <span role="alert" className="text-danger">
                {err.content}
              </span>
              <span className="text-muted">{content.length}/1000</span>
            </div>
          </div>
          {!review && (
            <div>
              <p className="mb-2 text-sm font-medium">Thêm ảnh (tối đa 5)</p>
              <div className="flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border border-line">
                    <img src={src} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Xóa ảnh"
                      onClick={() => setImages(images.filter((_, k) => k !== i))}
                      className="absolute right-0 top-0 rounded-bl bg-ink/70 p-0.5 text-white"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line text-muted hover:border-primary hover:text-primary">
                    <Icon name="image" size={18} />
                    <span className="text-[10px]">Thêm ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => addImages(e.target.files)}
                    />
                  </label>
                )}
              </div>
              <div className="mt-4">
                <Checkbox
                  label="Đánh giá ẩn danh"
                  checked={anon}
                  onChange={(e) => setAnon(e.target.checked)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
