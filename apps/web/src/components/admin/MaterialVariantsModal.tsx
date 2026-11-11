'use client';

// UC-ADM-14: "Vật liệu theo biến thể" của một mô hình 3D. Mỗi biến thể của sản phẩm có thể gắn một cấu hình vật liệu
// (màu, độ nhám, kim loại) áp lên một vật liệu CÓ TRONG tệp GLB; khách đổi biến thể thì trình xem 3D áp cấu hình này
// ngay ở client, không tải lại mô hình (UC-3D-03). Tên vật liệu lấy từ chính tệp GLB (GET /admin/models/:id/materials).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { Model3DAdminRow } from '@/types/api';

interface Draft {
  materialName: string;
  baseColor: string;
  roughness: string;
  metalness: string;
}

const EMPTY: Draft = { materialName: '', baseColor: '#CCCCCC', roughness: '', metalness: '' };

export default function MaterialVariantsModal({
  model,
  onClose,
}: {
  model: Model3DAdminRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const modelId = model?.modelId ?? 0;
  const enabled = Boolean(model);
  const names = useQuery({
    queryKey: ['admin', 'model-materials', modelId],
    queryFn: () => adminApi.models.materialNames(modelId),
    enabled,
  });
  const saved = useQuery({
    queryKey: ['admin', 'model-material-variants', modelId],
    queryFn: () => adminApi.models.materialVariants(modelId),
    enabled,
  });
  const product = useQuery({
    queryKey: ['admin', 'product', model?.productId],
    queryFn: () => adminApi.products.get(model!.productId),
    enabled,
  });
  const [draft, setDraft] = useState<Record<number, Draft>>({});

  useEffect(() => {
    if (!saved.data) return;
    const d: Record<number, Draft> = {};
    for (const r of saved.data)
      d[r.variantId] = {
        materialName: r.materialName,
        baseColor: r.config.baseColor ?? EMPTY.baseColor,
        roughness: r.config.roughness === undefined ? '' : String(r.config.roughness),
        metalness: r.config.metalness === undefined ? '' : String(r.config.metalness),
      };
    setDraft(d);
  }, [saved.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'model-material-variants', modelId] });
    qc.invalidateQueries({ queryKey: ['product'] });
  };
  const save = useMutation({
    mutationFn: ({ variantId, d }: { variantId: number; d: Draft }) =>
      adminApi.models.setMaterialVariant(modelId, variantId, {
        materialName: d.materialName,
        config: {
          baseColor: d.baseColor,
          ...(d.roughness !== '' ? { roughness: Number(d.roughness) } : {}),
          ...(d.metalness !== '' ? { metalness: Number(d.metalness) } : {}),
        },
      }),
    onSuccess: () => {
      toast.success('Đã lưu vật liệu cho biến thể.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (variantId: number) => adminApi.models.removeMaterialVariant(modelId, variantId),
    onSuccess: () => {
      toast.success('Đã xóa cấu hình vật liệu.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const variants = product.data?.variants ?? [];
  const materialNames = names.data?.names ?? [];
  const set = (id: number, patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY), ...patch } }));
  const savedIds = new Set((saved.data ?? []).map((r) => r.variantId));

  return (
    <Modal
      open={Boolean(model)}
      onClose={onClose}
      title="Vật liệu theo biến thể"
      width={820}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div data-testid="material-variants">
        <p className="mb-3 text-sm text-muted">
          Chọn vật liệu có trong tệp GLB và màu áp lên đó khi khách chọn từng biến thể. Khách đổi biến thể thì
          mô hình đổi màu ngay, không phải tải lại.
        </p>
        {(names.isLoading || saved.isLoading || product.isLoading) && <p aria-busy>Đang tải…</p>}
        {(names.isError || saved.isError || product.isError) && (
          <p role="alert" className="text-danger">
            {errorMessage(names.error ?? saved.error ?? product.error)}
          </p>
        )}
        {names.data && materialNames.length === 0 && (
          <p role="note" className="mb-3 text-sm text-warning">
            Mô hình chưa có tệp GLB đã xử lý nên chưa có danh sách vật liệu.
          </p>
        )}
        <div className="space-y-2">
          {variants.map((v) => {
            const d = draft[v.id] ?? EMPTY;
            const label = [v.color?.name, v.size, v.material].filter(Boolean).join(' · ') || v.sku;
            return (
              <div
                key={v.id}
                data-testid={`material-row-${v.id}`}
                className="grid grid-cols-[1.2fr_1.4fr_auto_90px_90px_auto] items-end gap-2 rounded-card border border-line p-2"
              >
                <div className="text-sm">
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs text-muted">{v.sku}</p>
                </div>
                <Select
                  aria-label={`Vật liệu của ${v.sku}`}
                  data-testid={`material-name-${v.id}`}
                  value={d.materialName}
                  placeholder="Chọn vật liệu"
                  options={materialNames.map((n) => ({ value: n, label: n }))}
                  onChange={(e) => set(v.id, { materialName: e.target.value })}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="color"
                    aria-label={`Màu của ${v.sku}`}
                    data-testid={`material-color-${v.id}`}
                    value={d.baseColor}
                    onChange={(e) => set(v.id, { baseColor: e.target.value.toUpperCase() })}
                  />
                  <span
                    aria-hidden
                    data-testid={`material-preview-${v.id}`}
                    className="inline-block h-9 w-9 rounded-full border border-line shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, #ffffffaa, ${d.baseColor} 55%, #00000040)`,
                    }}
                  />
                </label>
                <input
                  className="h-10 rounded-btn border border-line px-2 text-sm"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  placeholder="Độ nhám"
                  aria-label={`Độ nhám của ${v.sku}`}
                  value={d.roughness}
                  onChange={(e) => set(v.id, { roughness: e.target.value })}
                />
                <input
                  className="h-10 rounded-btn border border-line px-2 text-sm"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  placeholder="Kim loại"
                  aria-label={`Độ kim loại của ${v.sku}`}
                  value={d.metalness}
                  onChange={(e) => set(v.id, { metalness: e.target.value })}
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    data-testid={`material-save-${v.id}`}
                    disabled={!d.materialName}
                    loading={save.isPending && save.variables?.variantId === v.id}
                    onClick={() => save.mutate({ variantId: v.id, d })}
                  >
                    Lưu
                  </Button>
                  {savedIds.has(v.id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`material-remove-${v.id}`}
                      loading={remove.isPending && remove.variables === v.id}
                      onClick={() => remove.mutate(v.id)}
                    >
                      Xóa
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
