'use client';

// Yêu cầu đổi trả (WIREFRAME 7.9) – /account/returns/new?order=ALV-...
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Input';
import QuantityStepper from '@/components/ui/QuantityStepper';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate } from '@/lib/format';
import { returnReasonLabel, returnStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { orderApi, returnApi } from '@/services/cart.api';
import { toast } from '@/store/uiStore';

const STEPS = [
  'Gửi yêu cầu',
  'Cửa hàng duyệt',
  'Lấy hàng miễn phí',
  'Kiểm tra sản phẩm',
  'Hoàn tiền / Đổi hàng',
];

function Content() {
  const code = useSearchParams().get('order') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const order = useQuery({
    queryKey: ['order', code],
    queryFn: () => orderApi.detail(code),
    enabled: Boolean(code),
  });
  const history = useQuery({ queryKey: ['returns', 'recent'], queryFn: () => returnApi.list({}) });
  const [sel, setSel] = useState<Record<number, number>>({});
  const [type, setType] = useState<'refund' | 'exchange'>('refund');
  const [reason, setReason] = useState<keyof typeof returnReasonLabel>('defect');
  const [desc, setDesc] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (order.data) setSel(Object.fromEntries(order.data.items.map((i) => [i.id, 0])));
  }, [order.data?.id]);

  const submit = useMutation({
    mutationFn: () =>
      returnApi.create({
        orderId: order.data!.id,
        items: Object.entries(sel)
          .filter(([, q]) => q > 0)
          .map(([id, quantity]) => ({ orderItemId: Number(id), quantity })),
        type,
        reason,
        description: desc,
        images,
      }),
    onSuccess: (r) => {
      toast.success(`Đã gửi yêu cầu đổi trả #${r.code}.`);
      qc.invalidateQueries({ queryKey: ['returns'] });
      router.push('/account/returns');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!code)
    return (
      <EmptyState
        icon="refresh"
        title="Chưa chọn đơn hàng"
        description="Hãy chọn một đơn hàng đã giao để tạo yêu cầu đổi trả."
        action={<LinkButton href="/account/orders?tab=completed">Chọn đơn hàng</LinkButton>}
      />
    );
  if (order.isLoading) return <PageSkeleton />;
  if (order.isError) return <ErrorState onRetry={() => order.refetch()} />;
  const o = order.data!;
  const open = o.status === 'completed' && o.canReturnUntil && new Date(o.canReturnUntil) > new Date();
  if (!open) {
    return (
      <EmptyState
        icon="refresh"
        title="Đơn hàng không đủ điều kiện đổi trả"
        description="Chỉ đơn hàng đã giao trong vòng 7 ngày mới có thể gửi yêu cầu đổi trả."
        action={<LinkButton href={`/account/orders/${o.orderCode}`}>Xem đơn hàng</LinkButton>}
      />
    );
  }
  const daysLeft = Math.max(0, Math.ceil((new Date(o.canReturnUntil!).getTime() - Date.now()) / 86_400_000));
  const chosen = o.items.filter((i) => sel[i.id] > 0);
  const total = chosen.reduce((s, i) => s + i.unitPrice * sel[i.id], 0);

  const send = () => {
    const x: Record<string, string> = {};
    if (!chosen.length) x.items = 'Vui lòng chọn ít nhất một sản phẩm.';
    if (desc.trim().length < 10) x.description = 'Mô tả chi tiết tối thiểu 10 ký tự.';
    if (!images.length) x.images = 'Vui lòng tải lên ít nhất một ảnh minh chứng.';
    setErrs(x);
    if (!Object.keys(x).length) submit.mutate();
  };
  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files)
      .slice(0, 5 - images.length)
      .filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    setImages([...images, ...(await Promise.all(picked.map(readAsDataUrl)))]);
    setErrs((e) => ({ ...e, images: '' }));
  };

  return (
    <div className="space-y-5">
      <Link
        href={`/account/orders/${o.orderCode}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name="arrowLeft" size={16} /> Đơn hàng #{o.orderCode}
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold">Yêu cầu đổi trả</h1>
        <p className="mt-1 text-sm text-muted">
          Đơn #{o.orderCode} · Giao ngày {formatDate(o.deliveredAt)} ·{' '}
          <b className="text-primary">Còn {daysLeft} ngày để gửi yêu cầu (chính sách 7 ngày)</b>
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">
                1
              </span>{' '}
              Chọn sản phẩm
            </h2>
            <ul className="divide-y divide-line">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${it.productName}`}
                    className="h-4 w-4 accent-primary"
                    checked={sel[it.id] > 0}
                    onChange={(e) => setSel({ ...sel, [it.id]: e.target.checked ? 1 : 0 })}
                  />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-1 font-semibold">{it.productName}</p>
                    <p className="text-xs text-muted">
                      {it.variantLabel} · {formatCurrency(it.unitPrice)}
                    </p>
                  </div>
                  {sel[it.id] > 0 && (
                    <QuantityStepper
                      size="sm"
                      value={sel[it.id]}
                      max={it.quantity}
                      onChange={(q) => setSel({ ...sel, [it.id]: q })}
                    />
                  )}
                </li>
              ))}
            </ul>
            {errs.items && (
              <p role="alert" className="text-xs text-danger">
                {errs.items}
              </p>
            )}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">
                2
              </span>{' '}
              Hình thức
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['refund', 'Trả hàng & hoàn tiền', 'Hoàn tiền về phương thức thanh toán ban đầu'],
                  ['exchange', 'Đổi sản phẩm khác', 'Đổi sang màu/kích thước/sản phẩm khác'],
                ] as const
              ).map(([k, t, d]) => (
                <label
                  key={k}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-card border p-4',
                    type === k ? 'border-primary bg-primary-soft/40' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    className="mt-1 accent-primary"
                    checked={type === k}
                    onChange={() => setType(k)}
                  />
                  <span>
                    <span className="block font-semibold">{t}</span>
                    <span className="text-xs text-muted">{d}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">
                3
              </span>{' '}
              Lý do
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(returnReasonLabel) as Array<keyof typeof returnReasonLabel>).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="reason"
                    className="accent-primary"
                    checked={reason === k}
                    onChange={() => setReason(k)}
                  />{' '}
                  {returnReasonLabel[k]}
                </label>
              ))}
            </div>
            <Textarea
              label="Mô tả chi tiết"
              required
              rows={4}
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                setErrs((x) => ({ ...x, description: '' }));
              }}
              error={errs.description}
              placeholder="Mô tả tình trạng sản phẩm, vấn đề gặp phải…"
            />
            <div>
              <p className="mb-2 text-sm font-medium">
                Ảnh/video minh chứng <span className="text-danger">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border border-line">
                    <img src={src} alt={`Minh chứng ${i + 1}`} className="h-full w-full object-cover" />
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
                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line text-muted hover:border-primary">
                    <Icon name="upload" size={18} />
                    <span className="text-[10px]">Tải lên</span>
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
              {errs.images && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {errs.images}
                </p>
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="card space-y-2 p-5 text-sm">
            <h2 className="mb-1 font-bold">Tóm tắt</h2>
            <div className="flex justify-between">
              <span className="text-muted">Số sản phẩm</span>
              <span>{chosen.reduce((s, i) => s + sel[i.id], 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Giá trị sản phẩm</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Phí lấy hàng</span>
              <span className="text-emerald-600">Miễn phí</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-bold">
              <span>Hoàn về</span>
              <span className="text-primary">{formatCurrency(type === 'refund' ? total : 0)}</span>
            </div>
            <p className="text-xs text-muted">
              Dự kiến hoàn tiền sau 3–5 ngày làm việc kể từ khi cửa hàng nhận và kiểm tra hàng.
            </p>
            <Button block size="lg" loading={submit.isPending} onClick={send}>
              Gửi yêu cầu
            </Button>
          </section>
          <section className="rounded-card bg-surface-muted p-5 text-sm">
            <h2 className="mb-3 font-bold">Quy trình xử lý</h2>
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-bold">Yêu cầu trước đây</h2>
            {history.data?.items.length ? (
              <ul className="space-y-2">
                {history.data.items.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span>#{r.code}</span>
                    <StatusBadge info={returnStatusInfo[r.status]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Chưa có yêu cầu nào.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function NewReturnPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
