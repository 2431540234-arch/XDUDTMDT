'use client';

// Form thêm/sửa không gian mẫu – 5 tab dọc (WIREFRAME 3.3b): Thông tin cơ bản · Ảnh 360° · Điểm tương tác · Sản phẩm gợi ý · Cài đặt hiển thị
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FormSection, { FormGrid } from '@/components/admin/FormSection';
import { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import { uploadMany } from '@/services/media.api';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Select, Textarea } from '@/components/ui/Input';
import { ErrorState, PageSkeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { roomTypeLabel } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { RoomType } from '@aurelia-living/shared-types';

type Tab = 'basic' | 'pano' | 'hotspots' | 'products' | 'display';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'basic', label: 'Thông tin cơ bản' },
  { key: 'pano', label: 'Ảnh 360°' },
  { key: 'hotspots', label: 'Điểm tương tác (hotspot)' },
  { key: 'products', label: 'Sản phẩm gợi ý' },
  { key: 'display', label: 'Cài đặt hiển thị' },
];
const STYLES = ['Hiện đại', 'Bắc Âu', 'Tối giản', 'Japandi', 'Cổ điển', 'Luxury'];

interface Hot {
  type: 'product' | 'navigation' | 'info';
  yaw: number;
  pitch: number;
  productId: number | null;
  targetIndex: number | null;
  title: string;
  content: string;
}
interface Pano {
  url: string;
  title: string;
  hotspots: Hot[];
}

export default function SpaceForm({ spaceId }: { spaceId?: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const editing = Boolean(spaceId);
  const [tab, setTab] = useState<Tab>('basic');
  const [v, setV] = useState({
    title: '',
    slug: '',
    roomType: '' as RoomType | '',
    style: '',
    description: '',
    coverUrl: null as string | null,
    status: 'draft' as 'draft' | 'published' | 'archived',
  });
  const [panos, setPanos] = useState<Pano[]>([]);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [activePano, setActivePano] = useState(0);
  const [activeHot, setActiveHot] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ['admin', 'space', spaceId],
    queryFn: () => adminApi.spaces.get(spaceId!),
    enabled: editing,
  });
  const products = useQuery({
    queryKey: ['admin', 'products', 'pick'],
    queryFn: () => adminApi.products.list({ pageSize: 100, sort: 'name:asc' }),
  });

  useEffect(() => {
    const s = q.data;
    if (!s) return;
    setV({
      title: s.title,
      slug: s.slug,
      roomType: s.roomType,
      style: s.style ?? '',
      description: s.description ?? '',
      coverUrl: s.coverUrl,
      status: s.status,
    });
    setPanos(
      s.panoramas.map((p) => ({
        url: p.url,
        title: p.title ?? '',
        hotspots: p.hotspots.map((h) => ({
          type: h.type,
          yaw: h.yaw,
          pitch: h.pitch,
          productId: h.productId,
          targetIndex: h.targetPanoramaId ? s.panoramas.findIndex((x) => x.id === h.targetPanoramaId) : null,
          title: h.title ?? '',
          content: h.content ?? '',
        })),
      })),
    );
    setProductIds(s.products.map((p) => p.id));
  }, [q.data]);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setErrs((e) => ({ ...e, [k]: '' }));
  };
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...v,
        coverUrl: v.coverUrl,
        panoramas: panos.map((p) => ({ url: p.url, title: p.title, hotspots: p.hotspots })),
        productIds,
      };
      return editing ? adminApi.spaces.update(spaceId!, body) : adminApi.spaces.create(body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật không gian mẫu.' : 'Đã thêm không gian mẫu.');
      qc.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      qc.invalidateQueries({ queryKey: ['spaces'] });
      router.push('/admin/spaces');
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') {
        setErrs(e.fieldErrors());
        setTab('basic');
      }
      toast.error(e instanceof ApiClientError ? e.message : 'Không thể lưu.');
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (v.title.trim().length < 2) x.title = 'Vui lòng nhập tên không gian.';
    if (!v.roomType) x.roomType = 'Vui lòng chọn loại không gian.';
    if (v.description.trim().length < 10) x.description = 'Mô tả tối thiểu 10 ký tự.';
    setErrs(x);
    if (Object.keys(x).length) {
      setTab('basic');
      return toast.error('Vui lòng kiểm tra lại các trường bắt buộc.');
    }
    save.mutate();
  };

  if (editing && q.isLoading) return <PageSkeleton />;
  if (editing && q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const pano = panos[activePano];
  const updHot = (i: number, p: Partial<Hot>) =>
    setPanos(
      panos.map((pa, k) =>
        k === activePano
          ? { ...pa, hotspots: pa.hotspots.map((h, j) => (j === i ? { ...h, ...p } : h)) }
          : pa,
      ),
    );
  const placeHot = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const yaw = Math.round(((e.clientX - r.left) / r.width) * 360 - 180);
    const pitch = Math.round(90 - ((e.clientY - r.top) / r.height) * 180);
    setPanos(
      panos.map((pa, k) =>
        k === activePano
          ? {
              ...pa,
              hotspots: [
                ...pa.hotspots,
                { type: 'product', yaw, pitch, productId: null, targetIndex: null, title: '', content: '' },
              ],
            }
          : pa,
      ),
    );
    setActiveHot(pano.hotspots.length);
  };

  return (
    <div>
      <PageHeader
        back={
          <nav className="mb-2 text-sm text-muted">
            <Link href="/admin/spaces" className="hover:text-primary">
              ‹ Không gian mẫu
            </Link>{' '}
            ›{' '}
            <span className="font-semibold text-primary">
              {editing ? 'Sửa không gian mẫu' : 'Thêm không gian mẫu'}
            </span>
          </nav>
        }
        title={editing ? `Sửa: ${q.data?.title ?? ''}` : 'Thêm không gian mẫu'}
        description="Tạo không gian trải nghiệm 3D với ảnh 360° và sản phẩm gợi ý"
        actions={
          <>
            <LinkButton href="/admin/spaces" variant="ghost">
              Hủy
            </LinkButton>
            <Button loading={save.isPending} onClick={submit}>
              Lưu không gian
            </Button>
          </>
        }
      />
      <FormSection
        tabs={TABS.map((t) => ({ ...t, hasError: t.key === 'basic' && Object.values(errs).some(Boolean) }))}
        active={tab}
        onChange={setTab}
      >
        {tab === 'basic' && (
          <div className="space-y-4">
            <FormGrid>
              <Input
                label="Tên không gian"
                required
                value={v.title}
                onChange={(e) => set('title', e.target.value)}
                error={errs.title}
                wrapperClassName="sm:col-span-2"
              />
              <Input
                label="Đường dẫn (slug)"
                value={v.slug}
                onChange={(e) => set('slug', e.target.value)}
                error={errs.slug}
                hint={
                  editing
                    ? 'Đổi tên không đổi slug. Sửa ô này nếu muốn đổi đường dẫn.'
                    : 'Để trống để tự tạo từ tên.'
                }
                wrapperClassName="sm:col-span-2"
              />
              <Select
                label="Loại không gian"
                required
                placeholder="Chọn loại"
                value={v.roomType}
                onChange={(e) => set('roomType', e.target.value as RoomType)}
                error={errs.roomType}
                options={Object.entries(roomTypeLabel).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Phong cách"
                placeholder="Chọn phong cách"
                value={v.style}
                onChange={(e) => set('style', e.target.value)}
                options={STYLES.map((s) => ({ value: s, label: s }))}
              />
              <Textarea
                label="Mô tả"
                required
                rows={4}
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
                error={errs.description}
                wrapperClassName="sm:col-span-2"
              />
            </FormGrid>
            <UploadDropzone
              label="Ảnh đại diện"
              preview={v.coverUrl}
              onError={toast.error}
              onFiles={async ([f]) => set('coverUrl', await readAsDataUrl(f))}
            />
          </div>
        )}

        {tab === 'pano' && (
          <div className="space-y-4">
            <UploadDropzone
              label="Thêm ảnh 360° (equirectangular 2:1)"
              multiple
              maxMB={20}
              hint="Kéo thả hoặc click để tải ảnh 360° – PNG, JPG (tối đa 20MB)"
              onError={toast.error}
              onFiles={async (files) => {
                let urls: string[];
                try {
                  urls = await uploadMany(files, 'panorama', 2);
                } catch (e) {
                  return toast.error(errorMessage(e));
                }
                setPanos((cur) => [
                  ...cur,
                  ...urls.map((url, i) => ({ url, title: `Góc ${cur.length + i + 1}`, hotspots: [] })),
                ]);
              }}
            />
            {panos.length === 0 ? (
              <p className="rounded-card bg-surface-muted/60 p-4 text-sm text-muted">
                Chưa có ảnh 360°. Ảnh đầu tiên sẽ là góc nhìn mở đầu.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {panos.map((p, i) => (
                  <li key={i} className="overflow-hidden rounded-card border border-line">
                    <div className="aspect-[2/1] bg-surface-muted">
                      <img src={p.url} alt={p.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex items-center gap-2 p-2">
                      <input
                        aria-label="Tên góc"
                        className="field !py-1.5 text-sm"
                        value={p.title}
                        onChange={(e) =>
                          setPanos(panos.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))
                        }
                      />
                      {i === 0 && (
                        <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] text-white">
                          Mở đầu
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Xóa ảnh 360°"
                        className="p-1.5 text-muted hover:text-danger"
                        onClick={() => {
                          setPanos(panos.filter((_, k) => k !== i));
                          setActivePano(0);
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'hotspots' && (
          <div className="space-y-4">
            {panos.length === 0 ? (
              <p className="rounded-card bg-surface-muted/60 p-4 text-sm text-muted">
                Hãy thêm ít nhất một ảnh 360° ở tab trước.
              </p>
            ) : (
              <>
                <Select
                  label="Ảnh 360°"
                  value={activePano}
                  onChange={(e) => {
                    setActivePano(Number(e.target.value));
                    setActiveHot(null);
                  }}
                  options={panos.map((p, i) => ({
                    value: i,
                    label: `${i + 1}. ${p.title || 'Góc ' + (i + 1)}`,
                  }))}
                />
                <p className="text-xs text-muted">
                  Bấm vào ảnh để đặt một điểm tương tác (lưu toạ độ yaw/pitch).
                </p>
                <div
                  className="relative aspect-[2/1] cursor-crosshair overflow-hidden rounded-card border border-line bg-surface-muted"
                  onClick={placeHot}
                  role="application"
                  aria-label="Đặt điểm tương tác trên ảnh 360°"
                >
                  <img src={pano.url} alt="" className="pointer-events-none h-full w-full object-cover" />
                  {pano.hotspots.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Điểm ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveHot(i);
                      }}
                      className={cn(
                        'absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow',
                        h.type === 'product'
                          ? 'bg-primary'
                          : h.type === 'navigation'
                            ? 'bg-sky-600'
                            : 'bg-stone-600',
                        activeHot === i && 'ring-4 ring-white/70',
                      )}
                      style={{
                        left: `${((h.yaw + 180) / 360) * 100}%`,
                        top: `${((90 - h.pitch) / 180) * 100}%`,
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                {activeHot !== null &&
                  pano.hotspots[activeHot] &&
                  (() => {
                    const h = pano.hotspots[activeHot];
                    return (
                      <div className="grid gap-3 rounded-card border border-line p-4 sm:grid-cols-2">
                        <Select
                          label="Loại điểm"
                          value={h.type}
                          onChange={(e) => updHot(activeHot, { type: e.target.value as Hot['type'] })}
                          options={[
                            { value: 'product', label: 'Sản phẩm' },
                            { value: 'navigation', label: 'Điều hướng sang ảnh khác' },
                            { value: 'info', label: 'Thông tin' },
                          ]}
                        />
                        {h.type === 'product' && (
                          <Select
                            label="Sản phẩm"
                            placeholder="Chọn sản phẩm"
                            value={h.productId ?? ''}
                            onChange={(e) => updHot(activeHot, { productId: Number(e.target.value) || null })}
                            options={(products.data?.items ?? []).map((p) => ({
                              value: p.id,
                              label: p.name,
                            }))}
                          />
                        )}
                        {h.type === 'navigation' && (
                          <Select
                            label="Đến ảnh"
                            placeholder="Chọn ảnh đích"
                            value={h.targetIndex ?? ''}
                            onChange={(e) =>
                              updHot(activeHot, {
                                targetIndex: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            options={panos
                              .map((p, i) => ({ value: i, label: `${i + 1}. ${p.title}` }))
                              .filter((_, i) => i !== activePano)}
                          />
                        )}
                        {h.type !== 'product' && (
                          <Input
                            label="Tiêu đề"
                            value={h.title}
                            onChange={(e) => updHot(activeHot, { title: e.target.value })}
                          />
                        )}
                        {h.type === 'info' && (
                          <Input
                            label="Nội dung"
                            value={h.content}
                            onChange={(e) => updHot(activeHot, { content: e.target.value })}
                          />
                        )}
                        <p className="text-xs text-muted sm:col-span-2">
                          yaw {h.yaw}° · pitch {h.pitch}°
                        </p>
                        <Button
                          variant="danger"
                          size="sm"
                          className="w-fit"
                          onClick={() => {
                            setPanos(
                              panos.map((pa, k) =>
                                k === activePano
                                  ? { ...pa, hotspots: pa.hotspots.filter((_, j) => j !== activeHot) }
                                  : pa,
                              ),
                            );
                            setActiveHot(null);
                          }}
                        >
                          <Icon name="trash" size={14} /> Xóa điểm
                        </Button>
                      </div>
                    );
                  })()}
              </>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Chọn các sản phẩm xuất hiện trong không gian Mỗi sản phẩm sẽ có điểm tương tác trên ảnh đầu
              tiên.
            </p>
            <input
              className="field"
              placeholder="Tìm sản phẩm…"
              aria-label="Tìm sản phẩm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-sm font-semibold">Đã chọn {productIds.length} sản phẩm</p>
            <ul className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
              {(products.data?.items ?? [])
                .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                .map((p) => (
                  <li key={p.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-btn border p-2 text-sm',
                        productIds.includes(p.id) ? 'border-primary bg-primary-soft/40' : 'border-line',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={productIds.includes(p.id)}
                        onChange={() =>
                          setProductIds((s) =>
                            s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id],
                          )
                        }
                      />
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-muted">
                        {p.thumbnailUrl && (
                          <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="line-clamp-2">{p.name}</span>
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {tab === 'display' && (
          <div className="max-w-md space-y-4">
            <Select
              label="Trạng thái hiển thị"
              value={v.status}
              onChange={(e) => set('status', e.target.value as typeof v.status)}
              options={[
                { value: 'published', label: 'Đang hiển thị' },
                { value: 'draft', label: 'Bản nháp' },
                { value: 'archived', label: 'Ẩn hiển thị' },
              ]}
            />
            <p className="text-xs text-muted">Chỉ không gian “Đang hiển thị” mới xuất hiện trên website.</p>
          </div>
        )}
      </FormSection>
    </div>
  );
}
