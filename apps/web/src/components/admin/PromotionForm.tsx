'use client';

// Form tạo/sửa khuyến mãi (WIREFRAME 7.22) với xem trước coupon dạng vé
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CouponCard from '@/components/account/CouponCard';
import { PageHeader } from '@/components/admin/FilterBar';
import Button, { LinkButton } from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { useCategories } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import { toInputDate } from '@/lib/date';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { CouponView } from '@/types/api';

type Kind = 'percent' | 'fixed' | 'freeship';
const KINDS: Array<[Kind, string, string]> = [
  ['percent', 'Giảm theo %', 'Giảm một tỉ lệ phần trăm'],
  ['fixed', 'Giảm số tiền cố định', 'Trừ trực tiếp số tiền'],
  ['freeship', 'Miễn phí vận chuyển', 'Giảm đúng phí ship'],
];
const SCOPES: Array<[CouponView['appliesTo'], string]> = [
  ['all', 'Tất cả sản phẩm'],
  ['category', 'Theo danh mục'],
  ['product', 'Theo sản phẩm'],
  ['space', 'Theo không gian mẫu'],
];

const randomCode = () => `AUR${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const num = (s: string) => s.replace(/\D/g, '');

export default function PromotionForm({ couponId }: { couponId?: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const editing = Boolean(couponId);
  const cats = useCategories();
  const cur = useQuery({
    queryKey: ['admin', 'coupon', couponId],
    queryFn: () => adminApi.coupons.get(couponId!),
    enabled: editing,
  });
  const today = toInputDate(new Date());
  const [f, setF] = useState({
    name: '',
    code: '',
    description: '',
    kind: 'percent' as Kind,
    value: '',
    maxDiscount: '',
    minOrderValue: '',
    appliesTo: 'all' as CouponView['appliesTo'],
    categoryIds: [] as number[],
    group: '',
    channel: '',
    startsAt: today,
    endsAt: '',
    usageLimit: '',
    perUserLimit: '',
    isActive: true,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    const c = cur.data;
    if (!c) return;
    setF({
      name: c.name,
      code: c.code,
      description: c.description ?? '',
      kind: c.kind,
      value: String(c.value || ''),
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : '',
      minOrderValue: c.minOrderValue ? String(c.minOrderValue) : '',
      appliesTo: c.appliesTo,
      categoryIds: [],
      group: '',
      channel: '',
      startsAt: c.startsAt.slice(0, 10),
      endsAt: c.endsAt?.slice(0, 10) ?? '',
      usageLimit: c.usageLimit ? String(c.usageLimit) : '',
      perUserLimit: c.perUserLimit ? String(c.perUserLimit) : '',
      isActive: c.isActive,
    });
  }, [cur.data]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrs((e) => ({ ...e, [k]: '' }));
  };
  const preview = useMemo<CouponView>(
    () => ({
      id: 0,
      code: f.code || 'MÃ-GIẢM-GIÁ',
      type: f.kind === 'percent' ? 'percent' : 'fixed',
      value: Number(f.value) || 0,
      maxDiscount: Number(f.maxDiscount) || null,
      minOrderValue: Number(f.minOrderValue) || 0,
      usageLimit: Number(f.usageLimit) || null,
      perUserLimit: Number(f.perUserLimit) || null,
      usedCount: 0,
      startsAt: f.startsAt || today,
      endsAt: f.endsAt || null,
      isActive: f.isActive,
      createdAt: '',
      updatedAt: '',
      name: f.name || 'Tên chương trình khuyến mãi',
      description: f.description,
      appliesTo: f.appliesTo,
      appliesToLabel: SCOPES.find((s) => s[0] === f.appliesTo)?.[1] ?? '',
      kind: f.kind,
    }),
    [f, today],
  );

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name,
        code: f.code,
        description: f.description,
        kind: f.kind,
        value: Number(f.value),
        maxDiscount: Number(f.maxDiscount) || null,
        minOrderValue: Number(f.minOrderValue) || 0,
        appliesTo: f.appliesTo,
        categoryIds: f.categoryIds,
        startsAt: f.startsAt,
        endsAt: f.endsAt,
        usageLimit: Number(f.usageLimit) || null,
        perUserLimit: Number(f.perUserLimit) || null,
        isActive: f.isActive,
      };
      return editing
        ? adminApi.coupons.update(couponId!, body as never)
        : adminApi.coupons.create(body as never);
    },
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật khuyến mãi.' : 'Đã tạo khuyến mãi.');
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      router.push('/admin/promotions');
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else toast.error(e instanceof ApiClientError ? e.message : 'Không thể lưu khuyến mãi.');
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (f.name.trim().length < 2) x.name = 'Vui lòng nhập tên chương trình.';
    if (!/^[A-Za-z0-9_-]{4,20}$/.test(f.code)) x.code = 'Mã gồm 4–20 ký tự chữ hoặc số.';
    if (f.kind !== 'freeship' && !(Number(f.value) > 0)) x.value = 'Vui lòng nhập giá trị giảm.';
    if (f.kind === 'percent' && Number(f.value) > 100) x.value = 'Phần trăm tối đa là 100.';
    if (!f.startsAt) x.startsAt = 'Vui lòng chọn ngày bắt đầu.';
    if (!f.endsAt) x.endsAt = 'Vui lòng chọn ngày kết thúc.';
    else if (f.startsAt && f.endsAt < f.startsAt) x.endsAt = 'Ngày kết thúc phải sau ngày bắt đầu.';
    setErrs(x);
    if (!Object.keys(x).length) save.mutate();
  };

  if (editing && cur.isLoading) return <PageSkeleton />;
  if (editing && cur.isError) return <ErrorState onRetry={() => cur.refetch()} />;
  const leafCats = (cats.data ?? []).flatMap((c) => [c, ...c.children]);

  return (
    <div>
      <PageHeader
        back={
          <nav className="mb-2 text-sm text-muted">
            <Link href="/admin/promotions" className="hover:text-primary">
              ‹ Khuyến mãi
            </Link>{' '}
            ›{' '}
            <span className="font-semibold text-primary">
              {editing ? 'Sửa khuyến mãi' : 'Tạo khuyến mãi'}
            </span>
          </nav>
        }
        title={editing ? 'Sửa khuyến mãi' : 'Tạo khuyến mãi'}
        actions={
          <>
            <LinkButton href="/admin/promotions" variant="ghost">
              Hủy
            </LinkButton>
            <Button loading={save.isPending} onClick={submit}>
              Lưu khuyến mãi
            </Button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Thông tin chung</h2>
            <Input
              label="Tên chương trình"
              required
              value={f.name}
              onChange={(e) => set('name', e.target.value)}
              error={errs.name}
            />
            <div>
              <label htmlFor="promo-code" className="mb-1.5 block text-sm font-medium">
                Mã khuyến mãi <span className="text-danger">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="promo-code"
                  className={cn('field uppercase', errs.code && 'field-error')}
                  value={f.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  disabled={editing}
                />
                <Button variant="outline" disabled={editing} onClick={() => set('code', randomCode())}>
                  Tạo ngẫu nhiên
                </Button>
              </div>
              {errs.code && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {errs.code}
                </p>
              )}
            </div>
            <Textarea
              label="Mô tả"
              rows={2}
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Loại & giá trị giảm</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {KINDS.map(([k, t, d]) => (
                <label
                  key={k}
                  className={cn(
                    'flex cursor-pointer gap-2 rounded-card border p-3',
                    f.kind === k ? 'border-primary bg-primary-soft/40' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    className="mt-1 accent-primary"
                    checked={f.kind === k}
                    onChange={() => set('kind', k)}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{t}</span>
                    <span className="text-xs text-muted">{d}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label={f.kind === 'percent' ? 'Giá trị (%)' : 'Giá trị (đ)'}
                required={f.kind !== 'freeship'}
                disabled={f.kind === 'freeship'}
                inputMode="numeric"
                value={f.kind === 'freeship' ? '' : f.value}
                onChange={(e) => set('value', num(e.target.value))}
                error={errs.value}
              />
              <Input
                label="Giảm tối đa (đ)"
                inputMode="numeric"
                disabled={f.kind !== 'percent'}
                value={f.maxDiscount}
                onChange={(e) => set('maxDiscount', num(e.target.value))}
              />
              <Input
                label="Đơn tối thiểu (đ)"
                inputMode="numeric"
                value={f.minOrderValue}
                onChange={(e) => set('minOrderValue', num(e.target.value))}
              />
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Phạm vi áp dụng</h2>
            <div className="flex flex-wrap gap-4">
              {SCOPES.map(([k, t]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    className="accent-primary"
                    checked={f.appliesTo === k}
                    onChange={() => set('appliesTo', k)}
                  />{' '}
                  {t}
                </label>
              ))}
            </div>
            {f.appliesTo === 'category' && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn danh mục">
                {leafCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={f.categoryIds.includes(c.id)}
                    onClick={() =>
                      set(
                        'categoryIds',
                        f.categoryIds.includes(c.id)
                          ? f.categoryIds.filter((x) => x !== c.id)
                          : [...f.categoryIds, c.id],
                      )
                    }
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium',
                      f.categoryIds.includes(c.id)
                        ? 'border-primary bg-primary text-white'
                        : 'border-line hover:border-primary',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {(f.appliesTo === 'product' || f.appliesTo === 'space') && (
              <p className="rounded-btn bg-surface-muted/60 p-3 text-xs text-muted">
                Phạm vi theo {f.appliesTo === 'product' ? 'sản phẩm' : 'không gian mẫu'} được ghi nhận ở bản
                mô phỏng; áp dụng thực tế khi backend hỗ trợ.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Nhóm khách hàng"
                value={f.group}
                onChange={(e) => set('group', e.target.value)}
                placeholder="Tất cả khách hàng"
                options={[
                  { value: 'new', label: 'Khách hàng mới' },
                  { value: 'loyal', label: 'Khách hàng thân thiết' },
                ]}
              />
              <Select
                label="Kênh"
                value={f.channel}
                onChange={(e) => set('channel', e.target.value)}
                placeholder="Tất cả kênh"
                options={[
                  { value: 'web', label: 'Website' },
                  { value: 'app', label: 'Ứng dụng di động' },
                ]}
              />
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Thời gian & giới hạn</h2>
            <Input
              label="Bắt đầu"
              required
              type="date"
              value={f.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
              error={errs.startsAt}
            />
            <Input
              label="Kết thúc"
              required
              type="date"
              min={f.startsAt}
              value={f.endsAt}
              onChange={(e) => set('endsAt', e.target.value)}
              error={errs.endsAt}
            />
            <Input
              label="Tổng lượt dùng"
              inputMode="numeric"
              value={f.usageLimit}
              onChange={(e) => set('usageLimit', num(e.target.value))}
              hint="Để trống = không giới hạn"
            />
            <Input
              label="Lượt dùng / khách"
              inputMode="numeric"
              value={f.perUserLimit}
              onChange={(e) => set('perUserLimit', num(e.target.value))}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                role="switch"
                checked={f.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="h-4 w-4 accent-primary"
              />{' '}
              Kích hoạt
            </label>
          </section>
          <section>
            <h2 className="mb-2 font-bold">Xem trước</h2>
            <CouponCard coupon={preview} />
          </section>
        </div>
      </div>
    </div>
  );
}
