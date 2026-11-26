'use client';

// Tab "Mô hình 3D" của form sản phẩm: mô hình đang hiện, tải GLB lên, theo dõi xử lý và duyệt.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import ModelReview from '@/components/admin/ModelReview';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { formatFileSize } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { Model3DAdminRow, ProductDetail } from '@/types/api';

const STAGE_LABEL: Record<string, string> = {
  queued: 'Đang chờ trong hàng đợi…',
  generating: 'Đang tạo mô hình bằng AI…',
  normalizing: 'Đang chuẩn hóa và tạo các mức chi tiết…',
};

export default function Model3DPanel({ product }: { product: ProductDetail }) {
  const qc = useQueryClient();
  const key = ['admin', 'models', 'product', product.id];
  const list = useQuery({
    queryKey: key,
    queryFn: () => adminApi.models.list({ productId: product.id, pageSize: 50, sort: 'uploadedAt:desc' }),
    refetchInterval: (query) =>
      query.state.data?.items.some((r) => r.status === 'processing' || r.status === 'uploading')
        ? 2000
        : false,
  });
  const rows: Model3DAdminRow[] = list.data?.items ?? [];
  const working = rows.find((r) => r.status === 'processing' || r.status === 'uploading');
  const pending = rows.find((r) => r.status === 'pending_review');
  const failed = !working && !pending ? rows.find((r) => r.status === 'failed') : undefined;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'models'] });
    qc.invalidateQueries({ queryKey: ['admin', 'model'] });
    qc.invalidateQueries({ queryKey: ['admin', 'product', product.id] });
    qc.invalidateQueries({ queryKey: ['admin', 'ai3d'] });
    qc.invalidateQueries({ queryKey: ['product'] });
  };
  // xử lý nền vừa xong ⇒ tải lại dữ liệu màn duyệt
  const status = working?.status ?? pending?.status ?? failed?.status ?? 'idle';
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['admin', 'model'] });
    qc.invalidateQueries({ queryKey: ['admin', 'ai3d'] });
  }, [status, qc]);

  const [removeFloor, setRemoveFloor] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      adminApi.models.upload(file, { productId: product.id, format: 'glb', removeFloor }),
    onSuccess: () => {
      toast.success('Đã nhận tệp. Sau khi chuẩn hóa xong, hãy xem thử rồi duyệt.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const choose = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) return toast.error('Hệ thống chỉ hỗ trợ tệp GLB');
    if (file.size > 100 * 1024 * 1024) return toast.error('Tệp phải nhỏ hơn hoặc bằng 100MB.');
    upload.mutate(file);
  };
  const retry = useMutation({
    mutationFn: (id: number) => adminApi.models.reprocess(id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const discard = useMutation({
    mutationFn: (id: number) => adminApi.models.removeModel(id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const model = product.model;

  return (
    <div className="space-y-4 text-sm" data-testid="model3d-panel">
      {model ? (
        <div className="rounded-card border border-line p-4">
          <p className="font-semibold">Mô hình đang hiện cho khách</p>
          <ul className="mt-2 space-y-1 text-muted">
            {model.files.map((f) => (
              <li key={f.id}>
                • {f.fileName} (LOD {f.lod}, {formatFileSize(f.fileSize)})
              </li>
            ))}
            <li>
              • Kích thước: {model.lengthMm} × {model.widthMm} × {model.heightMm} mm
              {model.source ? ` · Nguồn: ${model.source === 'ai' ? 'AI' : 'tải lên'}` : ''}
            </li>
          </ul>
          <LinkButton href={`/products/${product.slug}/3d`} variant="outline" size="sm" className="mt-3">
            Xem như khách
          </LinkButton>
        </div>
      ) : (
        <p className="rounded-card bg-surface-muted/60 p-4 text-muted">
          Sản phẩm này chưa có mô hình 3D được duyệt, khách không thấy nút 3D.
        </p>
      )}

      {working && (
        <div role="status" data-testid="model-progress" className="rounded-card border border-line p-4">
          <p className="font-semibold">
            {working.status === 'uploading'
              ? 'Đang chờ tệp tải lên…'
              : (STAGE_LABEL[working.stage ?? ''] ?? 'Đang xử lý…')}
          </p>
          <p className="mt-1 text-muted">Trang tự cập nhật, bạn có thể rời đi rồi quay lại.</p>
        </div>
      )}

      {pending && <ModelReview modelId={pending.modelId} onChanged={refresh} />}

      {failed && (
        <div role="alert" data-testid="model-failed" className="rounded-card border border-danger/40 p-4">
          <p className="font-semibold text-danger">Lần tạo gần nhất bị lỗi</p>
          <p className="mt-1 text-muted">{failed.failureReason}</p>
          <div className="mt-3 flex gap-2">
            {failed.stage !== null && failed.source !== 'ai' && (
              <Button size="sm" variant="outline" onClick={() => retry.mutate(failed.modelId)}>
                Xử lý lại
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => discard.mutate(failed.modelId)}>
              Bỏ
            </Button>
          </div>
        </div>
      )}

      {!working && !pending && (
        <div className="space-y-3 rounded-card border border-line p-4">
          <p className="font-semibold">Tải tệp GLB lên</p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={removeFloor}
              onChange={(e) => setRemoveFloor(e.target.checked)}
            />
            Gỡ tấm sàn thừa nếu phát hiện
          </label>
          <input
            ref={input}
            type="file"
            accept=".glb"
            aria-label="Chọn tệp GLB"
            className="hidden"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="outline" loading={upload.isPending} onClick={() => input.current?.click()}>
            <Icon name="upload" size={16} /> Tải GLB lên
          </Button>
        </div>
      )}

      <LinkButton href={`/admin/models?productId=${product.id}`} variant="ghost" size="sm">
        Danh sách mô hình 3D
      </LinkButton>
    </div>
  );
}
