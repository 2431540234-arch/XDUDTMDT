'use client';

// UC-ADM-17: đặt mô hình 3D của sản phẩm vào ảnh 360° (tab "Đặt sản phẩm 3D" của form không gian mẫu).
// Khung xem là CHÍNH trình xem của khách: sửa vị trí/xoay/tỉ lệ ở ô bên phải hoặc kéo ghim trên ảnh thì mô hình đổi ngay (xem trước
// trực tiếp, chưa lưu); bấm "Lưu vị trí" mới ghi (PATCH). Mô hình đặt xong được lưu ngay vào DB qua API riêng, không đi theo nút Lưu
// của cả form.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { PanoramaView, PlacementView } from '@/types/api';

const SpacePanorama = dynamic(() => import('@/components/viewer/SpacePanorama'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-ink text-white/70">
      Đang tải ảnh 360°…
    </div>
  ),
});

type Pos = Pick<
  PlacementView,
  'yaw' | 'pitch' | 'distance' | 'rotationX' | 'rotationY' | 'rotationZ' | 'scale'
>;

const FIELDS: Array<{ key: keyof Pos; label: string; min: number; max: number; step: number }> = [
  { key: 'yaw', label: 'Yaw (trái/phải, °)', min: -180, max: 180, step: 0.5 },
  { key: 'pitch', label: 'Pitch (lên/xuống, °)', min: -90, max: 90, step: 0.5 },
  { key: 'distance', label: 'Khoảng cách (m)', min: 0.5, max: 20, step: 0.1 },
  { key: 'rotationY', label: 'Xoay quanh trục đứng Y (°)', min: -180, max: 180, step: 1 },
  { key: 'rotationX', label: 'Xoay X (°)', min: -180, max: 180, step: 1 },
  { key: 'rotationZ', label: 'Xoay Z (°)', min: -180, max: 180, step: 1 },
  { key: 'scale', label: 'Tỉ lệ', min: 0.1, max: 5, step: 0.05 },
];

export default function PlacementEditor({ panorama }: { panorama: PanoramaView }) {
  const qc = useQueryClient();
  const key = ['admin', 'placements', panorama.id];
  const list = useQuery({ queryKey: key, queryFn: () => adminApi.placements.list(panorama.id) });
  const products = useQuery({
    queryKey: ['admin', 'products', 'pick'],
    queryFn: () => adminApi.products.list({ pageSize: 100, sort: 'name:asc' }),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Partial<Pos> & { variantId?: number | null }>>({});
  const [adding, setAdding] = useState(false);
  const [addProduct, setAddProduct] = useState('');
  const [addVariant, setAddVariant] = useState('');

  const rows = useMemo(
    () => (list.data ?? []).map((r) => ({ ...r, ...(drafts[r.id] ?? {}) }) as PlacementView),
    [list.data, drafts],
  );
  const sel = rows.find((r) => r.id === selectedId) ?? null;
  const dirty = sel ? Boolean(drafts[sel.id]) : false;

  const detail = useQuery({
    queryKey: ['admin', 'product', Number(addProduct) || sel?.productId],
    queryFn: () => adminApi.products.get(Number(addProduct) || sel!.productId),
    enabled: Boolean(Number(addProduct) || sel),
  });
  const variants = detail.data?.variants ?? [];

  const patchDraft = useCallback((id: number, p: Partial<Pos> & { variantId?: number | null }) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...p } }));
  }, []);
  const clearDraft = (id: number) =>
    setDrafts((d) => {
      const { [id]: _x, ...rest } = d;
      void _x;
      return rest;
    });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['admin', 'space'] });
    qc.invalidateQueries({ queryKey: ['space'] });
  };
  const create = useMutation({
    mutationFn: () =>
      adminApi.placements.create(panorama.id, {
        productId: Number(addProduct),
        ...(addVariant ? { variantId: Number(addVariant) } : {}),
        yaw: panorama.defaultYaw,
        pitch: -20,
        distance: 3,
        scale: 1,
      }),
    onSuccess: (p) => {
      toast.success('Đã đặt sản phẩm 3D vào ảnh. Kéo ghim hoặc chỉnh số để đặt đúng chỗ.');
      setAdding(false);
      setAddProduct('');
      setAddVariant('');
      setSelectedId(p.id);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: () => {
      const d = drafts[sel!.id] ?? {};
      return adminApi.placements.update(panorama.id, sel!.id, d);
    },
    onSuccess: () => {
      toast.success('Đã lưu vị trí.');
      clearDraft(sel!.id);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.placements.remove(panorama.id, id),
    onSuccess: (_r, id) => {
      toast.success('Đã gỡ sản phẩm khỏi ảnh.');
      clearDraft(id);
      setSelectedId(null);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const withModel = (products.data?.items ?? []).filter((p) => p.has3dModel);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]" data-testid="placement-editor">
      <div className="aspect-[16/10] overflow-hidden rounded-card border border-line">
        <SpacePanorama
          key={panorama.id}
          panorama={{ ...panorama, hotspots: [] }}
          onSelect={() => undefined}
          placements={rows}
          selectedPlacementId={selectedId}
          onSelectPlacement={(p) => setSelectedId(p.id)}
          edit={sel ? { id: sel.id, onMove: (yaw, pitch) => patchDraft(sel.id, { yaw, pitch }) } : null}
        />
      </div>

      <div className="space-y-3">
        <Button onClick={() => setAdding((a) => !a)} aria-expanded={adding} data-testid="open-add-placement">
          <Icon name="cube" size={16} /> Đặt sản phẩm 3D
        </Button>

        {adding && (
          <div className="space-y-2 rounded-card border border-line p-3" data-testid="add-placement">
            <Select
              label="Sản phẩm có mô hình 3D"
              value={addProduct}
              placeholder="Chọn sản phẩm"
              data-testid="add-placement-product"
              options={withModel.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => {
                setAddProduct(e.target.value);
                setAddVariant('');
              }}
            />
            {addProduct && (
              <Select
                label="Biến thể (màu/chất liệu)"
                value={addVariant}
                placeholder="Mặc định"
                data-testid="add-placement-variant"
                options={variants.map((v) => ({
                  value: v.id,
                  label: [v.color?.name, v.size, v.material].filter(Boolean).join(' · ') || v.sku,
                }))}
                onChange={(e) => setAddVariant(e.target.value)}
              />
            )}
            <p className="text-xs text-muted">Dùng mô hình chính (đã xử lý xong) của sản phẩm.</p>
            <Button
              size="sm"
              data-testid="confirm-add-placement"
              disabled={!addProduct}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              Thêm vào ảnh
            </Button>
          </div>
        )}

        {list.isLoading && <p className="text-sm text-muted">Đang tải…</p>}
        {list.isError && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(list.error)}
          </p>
        )}
        {rows.length === 0 && !list.isLoading && (
          <p className="rounded-card bg-surface-muted/60 p-3 text-sm text-muted">
            Ảnh này chưa đặt sản phẩm 3D nào. Khách sẽ thấy ảnh như bình thường.
          </p>
        )}
        <ul className="space-y-1" aria-label="Sản phẩm 3D đã đặt">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                data-testid={`placement-row-${r.id}`}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-btn border px-3 py-2 text-left text-sm',
                  r.id === selectedId ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary',
                )}
              >
                <span className="font-semibold">{r.product?.name ?? `Sản phẩm #${r.productId}`}</span>
                <span className="text-xs text-muted">
                  {r.yaw.toFixed(0)}° / {r.pitch.toFixed(0)}°
                </span>
              </button>
            </li>
          ))}
        </ul>

        {sel && (
          <div className="space-y-2 rounded-card border border-line p-3" data-testid="placement-form">
            <p className="text-sm font-bold">{sel.product?.name}</p>
            <p className="text-xs text-muted">
              Kéo ghim <Icon name="cube" size={12} className="inline" /> trên ảnh để đổi hướng, hoặc chỉnh số
              bên dưới.
            </p>
            {variants.length > 0 && (
              <Select
                label="Biến thể"
                value={sel.variantId ?? ''}
                placeholder="Mặc định"
                options={variants.map((v) => ({
                  value: v.id,
                  label: [v.color?.name, v.size, v.material].filter(Boolean).join(' · ') || v.sku,
                }))}
                onChange={(e) =>
                  patchDraft(sel.id, { variantId: e.target.value ? Number(e.target.value) : null })
                }
              />
            )}
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs">
                <span className="flex justify-between">
                  <span>{f.label}</span>
                  <input
                    type="number"
                    aria-label={f.label}
                    data-testid={`pl-${f.key}`}
                    className="w-20 rounded border border-line px-1 text-right"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(sel[f.key].toFixed(2))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) patchDraft(sel.id, { [f.key]: n });
                    }}
                  />
                </span>
                <input
                  type="range"
                  aria-label={`${f.label} (thanh trượt)`}
                  className="w-full"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={Math.min(f.max, Math.max(f.min, sel[f.key]))}
                  onChange={(e) => patchDraft(sel.id, { [f.key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                data-testid="save-placement"
                disabled={!dirty}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Lưu vị trí
              </Button>
              {dirty && (
                <Button size="sm" variant="ghost" onClick={() => clearDraft(sel.id)}>
                  Hoàn tác
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                data-testid="remove-placement"
                loading={remove.isPending}
                onClick={() => remove.mutate(sel.id)}
              >
                Gỡ khỏi ảnh
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
