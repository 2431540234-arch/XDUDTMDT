'use client';

// Quản lý mô hình 3D (WIREFRAME 3.8) + modal tải lên (7.23)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatDate } from '@/lib/format';
import { modelStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { Model3DAdminRow } from '@/types/api';

const ModelPreview = dynamic(() => import('@/components/viewer/ModelPreview'), { ssr: false });

interface UploadItem {
  id: number;
  name: string;
  sizeMB: number;
  format: 'glb';
  file: File;
}

function UploadModal({
  open,
  onClose,
  defaultProductId,
}: {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
}) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [productId, setProductId] = useState(defaultProductId ?? '');
  const [scale, setScale] = useState('1');
  const [unit, setUnit] = useState('mm');
  const [createNew, setCreateNew] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const seq = useRef(1);
  const products = useQuery({
    queryKey: ['admin', 'products', 'pick'],
    queryFn: () => adminApi.products.list({ pageSize: 100, sort: 'name:asc' }),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setFiles([]);
      setCreateNew(false);
      setErr({});
      setProductId(defaultProductId ?? '');
    }
  }, [open, defaultProductId]);
  const add = (list: File[]) => {
    const ok: UploadItem[] = [];
    for (const f of list) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext !== 'glb') {
        toast.error('Hệ thống chỉ hỗ trợ tệp GLB');
        continue;
      }
      if (f.size > 100 * 1024 * 1024) {
        toast.error(`“${f.name}” vượt quá 100MB.`);
        continue;
      }
      ok.push({
        id: seq.current++,
        name: f.name,
        sizeMB: Math.max(0.1, Math.round((f.size / 1048576) * 10) / 10),
        format: 'glb',
        file: f,
      });
    }
    setFiles((cur) => [...cur, ...ok]);
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const f of files)
        await adminApi.models.upload(f.file, {
          productId: Number(productId),
          format: f.format,
          scale: Number(scale) || 1,
          unit,
          createNew,
        });
    },
    onSuccess: () => {
      toast.success('Đã nhận tệp. Mô hình 3D đang được xử lý nền, trạng thái sẽ tự cập nhật.');
      qc.invalidateQueries({ queryKey: ['admin', 'models'] });
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (!productId) x.productId = 'Vui lòng chọn sản phẩm liên kết.';
    if (!files.length) x.file = 'Vui lòng chọn ít nhất một tệp mô hình.';
    setErr(x);
    if (!Object.keys(x).length) save.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tải lên mô hình 3D"
      width={820}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Tải lên
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <UploadDropzone
            label="Tệp mô hình"
            accept=".glb"
            maxMB={100}
            multiple
            hint="Kéo thả hoặc click để chọn – chỉ GLB (tối đa 100MB)"
            onFiles={add}
            onError={toast.error}
          />
          {err.file && (
            <p role="alert" className="text-xs text-danger">
              {err.file}
            </p>
          )}
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="rounded-btn border border-line p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {f.sizeMB} MB
                    <button
                      type="button"
                      aria-label="Bỏ tệp"
                      onClick={() => setFiles(files.filter((x) => x.id !== f.id))}
                      className="text-muted hover:text-danger"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <Select
            label="Sản phẩm liên kết"
            required
            placeholder="Chọn sản phẩm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            error={err.productId}
            options={(products.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium">Xem trước 360°</p>
            <div className="h-44 overflow-hidden rounded-btn border border-line bg-surface-muted/50">
              {files.some((f) => f.format === 'glb') ? (
                <ModelPreview src="/mock/models/sofa.glb" alt="Xem trước mô hình" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Chọn tệp GLB để xem trước
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Bản xem trước mô phỏng (mô hình mẫu).</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tỉ lệ (scale)"
              inputMode="decimal"
              value={scale}
              onChange={(e) => setScale(e.target.value)}
            />
            <Select
              label="Đơn vị"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              options={[
                { value: 'mm', label: 'Milimet (mm)' },
                { value: 'cm', label: 'Centimet (cm)' },
                { value: 'm', label: 'Mét (m)' },
              ]}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={createNew}
              onChange={(e) => setCreateNew(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />{' '}
            Tạo mô hình mới (không thay thế mô hình chính hiện có)
          </label>
        </div>
      </div>
    </Modal>
  );
}

function Content() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const [st, patch] = useListState({
    q: '',
    page: 1,
    sort: 'uploadedAt:desc',
    productId: sp.get('productId') ?? '',
    format: '',
  });
  const q = useDebounced(st.q);
  const [upload, setUpload] = useState(false);
  const [preview, setPreview] = useState<Model3DAdminRow | null>(null);
  const [del, setDel] = useState<Model3DAdminRow | null>(null);
  const products = useQuery({
    queryKey: ['admin', 'products', 'pick'],
    queryFn: () => adminApi.products.list({ pageSize: 100, sort: 'name:asc' }),
  });
  const list = useQuery({
    queryKey: ['admin', 'models', q, st.page, st.sort, st.productId, st.format],
    queryFn: () =>
      adminApi.models.list({
        q,
        page: st.page,
        pageSize: 10,
        sort: st.sort,
        productId: st.productId,
        format: st.format,
      }),
    // còn mô hình đang xử lý nền ⇒ tự cập nhật trạng thái mỗi 2 giây (UC-ADM-13)
    refetchInterval: (query) =>
      query.state.data?.items.some((r) => r.status === 'processing' || r.status === 'uploading')
        ? 2000
        : false,
  });
  const remove = useMutation({
    mutationFn: (r: Model3DAdminRow) =>
      r.fileId === null ? adminApi.models.removeModel(r.modelId) : adminApi.models.remove(r.fileId),
    onSuccess: () => {
      toast.success('Đã xóa tệp mô hình.');
      setDel(null);
      qc.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reprocess = useMutation({
    mutationFn: (modelId: number) => adminApi.models.reprocess(modelId),
    onSuccess: () => {
      toast.success('Đã đưa mô hình vào hàng đợi xử lý lại.');
      qc.invalidateQueries({ queryKey: ['admin', 'models'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const makePrimary = useMutation({
    mutationFn: (modelId: number) => adminApi.models.setPrimary(modelId),
    onSuccess: () => {
      toast.success('Đã đặt làm mô hình chính của sản phẩm.');
      qc.invalidateQueries({ queryKey: ['admin', 'models'] });
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: Column<Model3DAdminRow>[] = [
    {
      key: 'img',
      header: 'Xem trước',
      render: (r) => (
        <span className="block h-12 w-12 overflow-hidden rounded-md bg-surface-muted">
          {r.productThumbnailUrl && (
            <img src={r.productThumbnailUrl} alt="" className="h-full w-full object-cover" />
          )}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên mô hình',
      sortKey: 'fileName',
      render: (r) => (
        <span>
          <code className="text-xs font-semibold">{r.fileName}</code>
          {r.lod && <span className="ml-1.5 text-xs text-muted">LOD {r.lod}</span>}
        </span>
      ),
    },
    { key: 'product', header: 'Sản phẩm', render: (r) => r.productName },
    {
      key: 'format',
      header: 'Định dạng',
      render: (r) => (
        <StatusBadge label={r.format.toUpperCase()} tone={r.format === 'glb' ? 'blue' : 'purple'} />
      ),
    },
    { key: 'size', header: 'Kích thước', sortKey: 'sizeMB', render: (r) => `${r.sizeMB} MB` },
    { key: 'date', header: 'Ngày tải lên', sortKey: 'uploadedAt', render: (r) => formatDate(r.uploadedAt) },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (r) => (
        <div data-testid="model-status" data-status={r.status} className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge info={modelStatusInfo[r.status]} />
            {r.isPrimary && <StatusBadge label="Mô hình chính" tone="blue" />}
          </div>
          {r.status === 'processing' && <p className="text-xs text-muted">Đang xử lý nền…</p>}
          {r.status === 'failed' && (
            <>
              <p className="max-w-xs text-xs text-danger" role="note">
                {r.failureReason ?? 'Xử lý mô hình thất bại.'}
              </p>
              <Button
                size="sm"
                variant="outline"
                loading={reprocess.isPending && reprocess.variables === r.modelId}
                onClick={() => reprocess.mutate(r.modelId)}
              >
                Xử lý lại
              </Button>
            </>
          )}
          {r.status === 'ready' && !r.isPrimary && (
            <Button
              size="sm"
              variant="ghost"
              loading={makePrimary.isPending && makePrimary.variables === r.modelId}
              onClick={() => makePrimary.mutate(r.modelId)}
            >
              Đặt làm mô hình chính
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <div>
      <PageHeader title="Mô hình 3D" description="Quản lý các mô hình 3D và tài nguyên liên quan." />
      <FilterBar
        search={{ value: st.q, onChange: (v) => patch({ q: v }), placeholder: 'Tìm theo tên tệp, sản phẩm…' }}
        selects={[
          {
            key: 'p',
            placeholder: 'Tất cả sản phẩm',
            value: st.productId,
            onChange: (v) => patch({ productId: v }),
            options: (products.data?.items ?? []).map((p) => ({ value: String(p.id), label: p.name })),
          },
          {
            key: 'f',
            placeholder: 'Tất cả loại tệp',
            value: st.format,
            onChange: (v) => patch({ format: v }),
            options: [{ value: 'glb', label: 'GLB' }],
          },
        ]}
        actions={
          <Button onClick={() => setUpload(true)}>
            <Icon name="upload" size={16} /> Tải lên mô hình
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        selectable
        selected={[]}
        sort={st.sort}
        onSort={(s) => patch({ sort: s })}
        page={list.data?.meta.page ?? st.page}
        total={list.data?.meta.total}
        onPage={(p) => patch({ page: p })}
        unit="mô hình"
        actions={[
          { label: 'Xem trước 3D', hidden: (r) => !r.glbUrl || r.format !== 'glb', onClick: setPreview },
          { label: 'Xóa', danger: true, onClick: setDel },
        ]}
      />
      <UploadModal open={upload} onClose={() => setUpload(false)} defaultProductId={st.productId} />
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.fileName} width={640}>
        <div className="h-80 overflow-hidden rounded-btn bg-surface-muted">
          {preview?.glbUrl && <ModelPreview src={preview.glbUrl} alt={preview.productName} />}
        </div>
      </Modal>
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa tệp mô hình"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del)}>
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Xóa <b>{del?.fileName}</b>?{' '}
          {del?.fileId === null
            ? 'Mô hình này chưa có tệp nào.'
            : 'Nếu là tệp cuối cùng, sản phẩm sẽ không còn mô hình 3D.'}
        </p>
      </Modal>
    </div>
  );
}

export default function AdminModelsPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
