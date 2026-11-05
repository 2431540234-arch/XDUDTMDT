'use client';

// Form thêm/sửa sản phẩm với 6 tab dọc (WIREFRAME 3.2b): Thông tin cơ bản · Hình ảnh · Biến thể · Mô hình 3D · Thuộc tính · SEO
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import FormSection, { FormGrid } from '@/components/admin/FormSection';
import { PageHeader } from '@/components/admin/FilterBar';
import Product360Editor from '@/components/admin/Product360Editor';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Select, Textarea } from '@/components/ui/Input';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { useCategories } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import { discountPercent, formatCurrency, slugify } from '@/lib/format';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { brandApi } from '@/services/product.api';
import { toast } from '@/store/uiStore';

type Tab = 'basic' | 'images' | 'variants' | 'model' | 'view360' | 'attrs' | 'seo';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'basic', label: 'Thông tin cơ bản' },
  { key: 'images', label: 'Hình ảnh' },
  { key: 'variants', label: 'Biến thể' },
  { key: 'model', label: 'Mô hình 3D' },
  { key: 'view360', label: 'Ảnh 360°' },
  { key: 'attrs', label: 'Thuộc tính' },
  { key: 'seo', label: 'SEO' },
];

const COLOR_PRESETS = [
  ['Kem', '#E8DCC8'],
  ['Be', '#D8C3A5'],
  ['Trắng', '#F5F5F0'],
  ['Nâu', '#7B5239'],
  ['Đen', '#2B2B2B'],
  ['Xám', '#8E8E8E'],
  ['Xanh', '#3F6B8F'],
  ['Xanh rêu', '#6B7D5C'],
  ['Gỗ sồi', '#C9A26B'],
  ['Óc chó', '#5C4033'],
];
const MATERIALS = ['Vải', 'Da', 'Nỉ', 'Gỗ', 'Kim loại', 'Đá', 'Kính'];
const STYLES = ['Hiện đại', 'Bắc Âu', 'Tối giản', 'Japandi', 'Cổ điển', 'Luxury'];

interface VariantRow {
  id?: number;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  price: number;
  salePrice: number | '';
  stockQuantity: number;
}
interface Values {
  name: string;
  sku: string;
  categoryId: string;
  status: 'published' | 'draft' | 'archived';
  brandId: string;
  price: string;
  originalPrice: string;
  stock: string;
  shortDescription: string;
  description: string;
  material: string;
  style: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
}
const EMPTY: Values = {
  name: '',
  sku: '',
  categoryId: '',
  status: 'published',
  brandId: '',
  price: '',
  originalPrice: '',
  stock: '',
  shortDescription: '',
  description: '',
  material: '',
  style: '',
  slug: '',
  metaTitle: '',
  metaDescription: '',
};

function RichEditor({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    onChange(`${value.slice(0, a)}${before}${value.slice(a, b) || 'văn bản'}${after}${value.slice(b)}`);
  };
  const line = (prefix: string) => onChange(`${value}${value && !value.endsWith('\n') ? '\n' : ''}${prefix}`);
  const tools = [
    { label: 'In đậm', icon: <b>B</b>, run: () => wrap('**') },
    { label: 'In nghiêng', icon: <i>I</i>, run: () => wrap('_') },
    { label: 'Gạch chân', icon: <u>U</u>, run: () => wrap('<u>', '</u>') },
    { label: 'Danh sách', icon: <Icon name="list" size={15} />, run: () => line('- ') },
    { label: 'Chèn liên kết', icon: <Icon name="link" size={15} />, run: () => wrap('[', '](https://)') },
    { label: 'Chèn ảnh', icon: <Icon name="image" size={15} />, run: () => wrap('![mô tả ảnh](', ')') },
  ];
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" htmlFor="pf-desc">
        Mô tả chi tiết
      </label>
      <div
        className={cn(
          'overflow-hidden rounded-btn border border-line focus-within:border-primary',
          error && 'border-danger',
        )}
      >
        <div
          className="flex gap-1 border-b border-line bg-surface-muted/50 p-1.5"
          role="toolbar"
          aria-label="Định dạng văn bản"
        >
          {tools.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              onClick={t.run}
              className="flex h-8 w-8 items-center justify-center rounded text-sm hover:bg-white"
            >
              {t.icon}
            </button>
          ))}
        </div>
        <textarea
          id="pf-desc"
          ref={ref}
          rows={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y bg-white p-3 text-sm outline-none"
          placeholder="Nhập mô tả chi tiết (hỗ trợ định dạng Markdown cơ bản)…"
        />
      </div>
    </div>
  );
}

export default function ProductForm({ productId }: { productId?: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const editing = Boolean(productId);
  const [tab, setTab] = useState<Tab>('basic');
  const [v, setV] = useState<Values>(EMPTY);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Array<{ url: string; isPrimary: boolean }>>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>([]);
  const [features, setFeatures] = useState('');
  const cats = useCategories();
  const brands = useQuery({ queryKey: ['brands'], queryFn: brandApi.list });
  const q = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminApi.products.get(productId!),
    enabled: editing,
  });

  useEffect(() => {
    const p = q.data;
    if (!p) return;
    setV({
      name: p.name,
      sku: p.sku,
      categoryId: String(p.categoryId ?? ''),
      status: p.status,
      brandId: String(p.brandId ?? ''),
      price: String(p.salePrice ?? p.price),
      originalPrice: p.salePrice ? String(p.price) : '',
      stock: String(p.stockQuantity),
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      material: p.material ?? '',
      style: p.style ?? '',
      slug: p.slug,
      metaTitle: p.metaTitle ?? '',
      metaDescription: p.metaDescription ?? '',
    });
    setImages(
      p.images.filter((i) => i.variantId === null).map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
    );
    setVariants(
      p.variants
        .filter((x) => x.isActive)
        .map((x) => ({
          id: x.id,
          colorName: x.color?.name ?? '',
          colorHex: x.color?.hex ?? '#D8C3A5',
          size: x.size ?? '',
          sku: x.sku,
          price: x.price,
          salePrice: x.salePrice ?? '',
          stockQuantity: x.stockQuantity,
        })),
    );
    setSpecs(p.specs);
    setFeatures(p.features.join('\n'));
  }, [q.data]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setErrs((e) => ({ ...e, [k]: '' }));
  };
  const price = Number(v.price) || 0;
  const original = Number(v.originalPrice) || 0;
  const discount = discountPercent(price, original);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: v.name,
        sku: v.sku,
        categoryId: Number(v.categoryId),
        brandId: v.brandId ? Number(v.brandId) : null,
        status: v.status,
        price: Number(v.price),
        originalPrice: Number(v.originalPrice) || undefined,
        stock: Number(v.stock),
        shortDescription: v.shortDescription,
        description: v.description,
        material: v.material || null,
        style: v.style,
        slug: v.slug || slugify(v.name),
        metaTitle: v.metaTitle,
        metaDescription: v.metaDescription,
        images,
        specs: specs.filter((s) => s.label.trim() && s.value.trim()),
        features: features
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        variants: variants.length
          ? variants.map((x) => ({
              id: x.id,
              color: x.colorName ? { name: x.colorName, hex: x.colorHex } : null,
              size: x.size || null,
              sku: x.sku,
              price: Number(x.price),
              salePrice: x.salePrice === '' ? null : Number(x.salePrice),
              stockQuantity: Number(x.stockQuantity),
            }))
          : undefined,
      };
      return editing ? adminApi.products.update(productId!, body) : adminApi.products.create(body);
    },
    onSuccess: (p) => {
      toast.success(editing ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'product', productId] });
      router.push(editing ? '/admin/products' : `/admin/products/${p.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') {
        setErrs(e.fieldErrors());
        setTab('basic');
      } else if (e instanceof ApiClientError && e.code === 'CONFLICT') {
        setErrs({ sku: 'SKU đã tồn tại.' });
        setTab('basic');
      }
      toast.error(e instanceof ApiClientError ? e.message : 'Không thể lưu sản phẩm.');
    },
  });

  const submit = () => {
    const x: Record<string, string> = {};
    if (v.name.trim().length < 2) x.name = 'Vui lòng nhập tên sản phẩm.';
    if (!v.sku.trim()) x.sku = 'Vui lòng nhập SKU.';
    if (!v.categoryId) x.categoryId = 'Vui lòng chọn danh mục.';
    if (!(price > 0)) x.price = 'Giá bán phải lớn hơn 0.';
    if (original && original <= price) x.originalPrice = 'Giá gốc phải lớn hơn giá bán.';
    if (v.stock === '' || Number(v.stock) < 0) x.stock = 'Vui lòng nhập tồn kho (≥ 0).';
    if (!v.shortDescription.trim()) x.shortDescription = 'Vui lòng nhập mô tả ngắn.';
    setErrs(x);
    if (Object.keys(x).length) {
      setTab('basic');
      return toast.error('Vui lòng kiểm tra lại các trường bắt buộc.');
    }
    save.mutate();
  };

  if (editing && q.isLoading) return <PageSkeleton />;
  if (editing && q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const tabs = TABS.filter((t) => editing || t.key !== 'view360').map((t) => ({
    ...t,
    hasError: t.key === 'basic' && Object.values(errs).some(Boolean),
  }));
  const catOptions = (cats.data ?? []).flatMap((c) => [
    { value: String(c.id), label: c.name, group: true },
    ...c.children.map((x) => ({ value: String(x.id), label: `— ${x.name}`, group: false })),
  ]);

  return (
    <div>
      <PageHeader
        back={
          <nav className="mb-2 flex items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
            <Link href="/admin/products" className="hover:text-primary">
              ‹ Sản phẩm
            </Link>
            <span>›</span>
            <span className="font-semibold text-primary">{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</span>
          </nav>
        }
        title={editing ? `Sửa: ${q.data?.name ?? ''}` : 'Thêm sản phẩm'}
        description={editing ? undefined : 'Nhập thông tin sản phẩm, biến thể, hình ảnh và mô hình 3D.'}
        actions={
          <>
            <LinkButton href="/admin/products" variant="ghost">
              Hủy
            </LinkButton>
            <Button loading={save.isPending} onClick={submit}>
              Lưu sản phẩm
            </Button>
          </>
        }
      />
      <FormSection tabs={tabs} active={tab} onChange={setTab}>
        {tab === 'basic' && (
          <div className="space-y-4">
            <FormGrid>
              <Input
                label="Tên sản phẩm"
                required
                value={v.name}
                onChange={(e) => set('name', e.target.value)}
                error={errs.name}
                wrapperClassName="sm:col-span-2"
              />
              <Input
                label="SKU"
                required
                value={v.sku}
                onChange={(e) => set('sku', e.target.value)}
                error={errs.sku}
                disabled={editing}
                hint={editing ? 'SKU được quản lý theo từng biến thể ở tab Biến thể.' : undefined}
              />
              <Select
                label="Danh mục"
                required
                placeholder="Chọn danh mục"
                value={v.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                error={errs.categoryId}
              >
                {catOptions.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.group}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Trạng thái"
                required
                value={v.status}
                onChange={(e) => set('status', e.target.value as Values['status'])}
                options={[
                  { value: 'published', label: 'Đang bán' },
                  { value: 'draft', label: 'Bản nháp' },
                  { value: 'archived', label: 'Ẩn' },
                ]}
              />
              <Select
                label="Thương hiệu"
                placeholder="Chọn thương hiệu"
                value={v.brandId}
                onChange={(e) => set('brandId', e.target.value)}
                options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
              />
              <Input
                label="Giá bán (đ)"
                required
                inputMode="numeric"
                value={v.price}
                onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))}
                error={errs.price}
                hint={price ? formatCurrency(price) : undefined}
              />
              <Input
                label="Giá gốc (đ)"
                inputMode="numeric"
                value={v.originalPrice}
                onChange={(e) => set('originalPrice', e.target.value.replace(/\D/g, ''))}
                error={errs.originalPrice}
                hint={original ? formatCurrency(original) : 'Để trống nếu không giảm giá'}
              />
              <Input
                label="Giảm giá (%)"
                inputMode="numeric"
                value={original ? String(discount) : ''}
                disabled={!original}
                onChange={(e) => {
                  const d = Math.min(90, Number(e.target.value.replace(/\D/g, '')) || 0);
                  if (original) set('price', String(Math.round((original * (100 - d)) / 100 / 1000) * 1000));
                }}
                hint="Tự tính từ giá bán và giá gốc"
              />
              <Input
                label="Tồn kho"
                required
                inputMode="numeric"
                value={v.stock}
                onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))}
                error={errs.stock}
                disabled={variants.length > 1}
                hint={variants.length > 1 ? 'Tồn kho theo từng biến thể (tab Biến thể).' : undefined}
              />
              <Textarea
                label="Mô tả ngắn"
                required
                rows={3}
                value={v.shortDescription}
                onChange={(e) => set('shortDescription', e.target.value)}
                error={errs.shortDescription}
                wrapperClassName="sm:col-span-2"
              />
            </FormGrid>
            <RichEditor value={v.description} onChange={(d) => set('description', d)} />
          </div>
        )}

        {tab === 'images' && (
          <div className="space-y-4">
            <UploadDropzone
              label="Tải ảnh sản phẩm"
              multiple
              hint="Kéo thả ảnh hoặc click để tải lên – PNG, JPG (tối đa 5MB/ảnh)"
              onError={toast.error}
              onFiles={async (files) => {
                const urls = await Promise.all(files.map(readAsDataUrl));
                setImages((cur) => [
                  ...cur,
                  ...urls.map((url, i) => ({ url, isPrimary: cur.length === 0 && i === 0 })),
                ]);
              }}
            />
            <ImagesEditor images={images} setImages={setImages} />
          </div>
        )}

        {tab === 'variants' && (
          <VariantsEditor variants={variants} setVariants={setVariants} baseSku={v.sku} basePrice={price} />
        )}

        {tab === 'model' && (
          <div className="space-y-3 text-sm">
            {q.data?.model ? (
              <div className="rounded-card border border-line p-4">
                <p className="font-semibold">Mô hình chính đang dùng</p>
                <ul className="mt-2 space-y-1 text-muted">
                  {q.data.model.files.map((f) => (
                    <li key={f.id}>
                      • {f.fileName} ({f.format.toUpperCase()}, {(f.fileSize / 1048576).toFixed(1)} MB)
                    </li>
                  ))}
                  <li>
                    • Kích thước thật: {q.data.model.lengthMm} × {q.data.model.widthMm} ×{' '}
                    {q.data.model.heightMm} mm · Đặt trên:{' '}
                    {q.data.model.placement === 'floor'
                      ? 'sàn nhà'
                      : q.data.model.placement === 'wall'
                        ? 'tường'
                        : 'mặt bàn'}
                  </li>
                </ul>
                <LinkButton href={`/products/${q.data.slug}/3d`} variant="outline" size="sm" className="mt-3">
                  Xem trước 3D
                </LinkButton>
              </div>
            ) : (
              <p className="rounded-card bg-surface-muted/60 p-4 text-muted">
                Sản phẩm này chưa có mô hình 3D.
              </p>
            )}
            <LinkButton href={`/admin/models${productId ? `?productId=${productId}` : ''}`} variant="outline">
              <Icon name="upload" size={16} /> Quản lý & tải lên mô hình 3D
            </LinkButton>
          </div>
        )}

        {tab === 'view360' && editing && <Product360Editor productId={productId!} />}

        {tab === 'attrs' && (
          <div className="space-y-5">
            <FormGrid>
              <Select
                label="Chất liệu"
                placeholder="Chọn chất liệu"
                value={v.material}
                onChange={(e) => set('material', e.target.value)}
                options={MATERIALS.map((m) => ({ value: m, label: m }))}
              />
              <Select
                label="Phong cách"
                placeholder="Chọn phong cách"
                value={v.style}
                onChange={(e) => set('style', e.target.value)}
                options={STYLES.map((m) => ({ value: m, label: m }))}
              />
            </FormGrid>
            <Textarea
              label="Đặc điểm nổi bật (mỗi dòng một ý)"
              rows={5}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
            />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Thông số kỹ thuật</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSpecs([...specs, { label: '', value: '' }])}
                >
                  <Icon name="plus" size={14} /> Thêm dòng
                </Button>
              </div>
              <div className="space-y-2">
                {specs.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                    <input
                      aria-label="Tên thông số"
                      className="field"
                      placeholder="Tên thông số"
                      value={s.label}
                      onChange={(e) =>
                        setSpecs(specs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    <input
                      aria-label="Giá trị"
                      className="field"
                      placeholder="Giá trị"
                      value={s.value}
                      onChange={(e) =>
                        setSpecs(specs.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))
                      }
                    />
                    <button
                      type="button"
                      aria-label="Xóa dòng"
                      className="rounded p-2 text-muted hover:text-danger"
                      onClick={() => setSpecs(specs.filter((_, k) => k !== i))}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'seo' && (
          <div className="space-y-4">
            <Input
              label="Đường dẫn (slug)"
              value={v.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder={slugify(v.name) || 'tu-dong-tao-tu-ten'}
              hint={`/products/${v.slug || slugify(v.name) || '…'}`}
            />
            <Input
              label="Tiêu đề SEO"
              value={v.metaTitle}
              onChange={(e) => set('metaTitle', e.target.value)}
              hint={`${v.metaTitle.length}/60 ký tự`}
            />
            <Textarea
              label="Mô tả SEO"
              rows={3}
              value={v.metaDescription}
              onChange={(e) => set('metaDescription', e.target.value)}
              hint={`${v.metaDescription.length}/160 ký tự`}
            />
          </div>
        )}
      </FormSection>
    </div>
  );
}

function ImagesEditor({
  images,
  setImages,
}: {
  images: Array<{ url: string; isPrimary: boolean }>;
  setImages: (v: Array<{ url: string; isPrimary: boolean }>) => void;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    setImages(next);
  };
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        {images.length} ảnh · ảnh đầu tiên (hoặc ảnh được đánh dấu) là ảnh đại diện.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((im, i) => (
          <li key={i} className="overflow-hidden rounded-card border border-line">
            <div className="aspect-[4/3] bg-surface-muted">
              <img src={im.url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-1 p-2 text-xs">
              <button
                type="button"
                onClick={() => setImages(images.map((x, k) => ({ ...x, isPrimary: k === i })))}
                className={cn(
                  'rounded px-2 py-1 font-semibold',
                  im.isPrimary ? 'bg-primary text-white' : 'bg-surface-muted hover:bg-line',
                )}
              >
                {im.isPrimary ? 'Ảnh chính' : 'Đặt làm chính'}
              </button>
              <span className="flex">
                <button
                  type="button"
                  aria-label="Lên"
                  onClick={() => move(i, -1)}
                  className="p-1 hover:text-primary"
                >
                  <Icon name="chevronLeft" size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Xuống"
                  onClick={() => move(i, 1)}
                  className="p-1 hover:text-primary"
                >
                  <Icon name="chevronRight" size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Xóa ảnh"
                  onClick={() =>
                    setImages(
                      images
                        .filter((_, k) => k !== i)
                        .map((x, k, arr) => ({
                          ...x,
                          isPrimary: arr.some((y) => y.isPrimary) ? x.isPrimary : k === 0,
                        })),
                    )
                  }
                  className="p-1 hover:text-danger"
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariantsEditor({
  variants,
  setVariants,
  baseSku,
  basePrice,
}: {
  variants: VariantRow[];
  setVariants: (v: VariantRow[]) => void;
  baseSku: string;
  basePrice: number;
}) {
  const upd = (i: number, p: Partial<VariantRow>) =>
    setVariants(variants.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const add = () =>
    setVariants([
      ...variants,
      {
        colorName: 'Kem',
        colorHex: '#E8DCC8',
        size: '',
        sku: `${baseSku || 'SKU'}-${variants.length + 1}`,
        price: basePrice,
        salePrice: '',
        stockQuantity: 10,
      },
    ]);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">
          Mỗi biến thể có SKU, giá và tồn kho riêng. Để trống nếu sản phẩm chỉ có một phiên bản.
        </p>
        <Button size="sm" onClick={add}>
          <Icon name="plus" size={14} /> Thêm biến thể
        </Button>
      </div>
      {variants.length === 0 ? (
        <p className="rounded-card bg-surface-muted/60 p-4 text-sm text-muted">
          Chưa có biến thể – hệ thống sẽ tạo biến thể mặc định từ giá bán và tồn kho ở tab Thông tin cơ bản.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Màu</th>
                <th>Kích thước</th>
                <th>SKU</th>
                <th>Giá niêm yết</th>
                <th>Giá khuyến mãi</th>
                <th>Tồn kho</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {variants.map((x, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-black/15"
                        style={{ background: x.colorHex }}
                      />
                      <select
                        aria-label="Màu"
                        className="field !py-1.5"
                        value={x.colorName}
                        onChange={(e) => {
                          const c = COLOR_PRESETS.find((p) => p[0] === e.target.value);
                          upd(i, { colorName: e.target.value, colorHex: c?.[1] ?? x.colorHex });
                        }}
                      >
                        <option value="">Không có</option>
                        {COLOR_PRESETS.map(([n]) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label="Kích thước"
                      className="field !py-1.5"
                      value={x.size}
                      onChange={(e) => upd(i, { size: e.target.value })}
                      placeholder="3 chỗ"
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label="SKU"
                      className="field !py-1.5"
                      value={x.sku}
                      onChange={(e) => upd(i, { sku: e.target.value })}
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label="Giá niêm yết"
                      inputMode="numeric"
                      className="field !py-1.5"
                      value={x.price}
                      onChange={(e) => upd(i, { price: Number(e.target.value.replace(/\D/g, '')) })}
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label="Giá khuyến mãi"
                      inputMode="numeric"
                      className="field !py-1.5"
                      value={x.salePrice}
                      onChange={(e) =>
                        upd(i, {
                          salePrice: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                        })
                      }
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      aria-label="Tồn kho"
                      inputMode="numeric"
                      className="field !py-1.5"
                      value={x.stockQuantity}
                      onChange={(e) => upd(i, { stockQuantity: Number(e.target.value.replace(/\D/g, '')) })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label="Xóa biến thể"
                      className="p-1.5 text-muted hover:text-danger"
                      onClick={() => setVariants(variants.filter((_, k) => k !== i))}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
