'use client';

// Quản lý thương hiệu (UC-ADM-06): danh sách, thêm/sửa (tên, slug, logo, bật/tắt), xóa có cảnh báo số sản phẩm sẽ mất thương hiệu
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { slugify } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { BrandAdmin } from '@/types/api';

interface Form {
  name: string;
  slug: string;
  slugTouched: boolean;
  logoUrl: string | null;
  isActive: boolean;
}
const EMPTY: Form = { name: '', slug: '', slugTouched: false, logoUrl: null, isActive: true };

function BrandModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: BrandAdmin | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrs({});
    setF(
      editing
        ? {
            name: editing.name,
            slug: editing.slug,
            slugTouched: true,
            logoUrl: editing.logoUrl,
            isActive: editing.isActive,
          }
        : EMPTY,
    );
  }, [open, editing]);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        slug: f.slug.trim() || undefined,
        // chỉ gửi logo khi thay mới (data-URL); null = xóa logo
        logoUrl: f.logoUrl !== editing?.logoUrl ? f.logoUrl : undefined,
        isActive: f.isActive,
      };
      return editing ? adminApi.brands.update(editing.id, body) : adminApi.brands.create(body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật thương hiệu.' : 'Đã thêm thương hiệu.');
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      qc.invalidateQueries({ queryKey: ['brands'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else if (e instanceof ApiClientError && e.code === 'CONFLICT')
        setErrs({ slug: e.message }); // slug trùng (409)
      else toast.error(errorMessage(e));
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (!f.name.trim()) x.name = 'Vui lòng nhập tên thương hiệu.';
    else if (f.name.trim().length > 150) x.name = 'Tên thương hiệu tối đa 150 ký tự.';
    setErrs(x);
    if (!Object.keys(x).length) save.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Sửa thương hiệu' : 'Thêm thương hiệu'}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Lưu thương hiệu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Tên thương hiệu"
          required
          value={f.name}
          onChange={(e) => {
            const v = e.target.value;
            setF((s) => ({ ...s, name: v, ...(s.slugTouched || editing ? {} : { slug: slugify(v) }) }));
            setErrs((x) => ({ ...x, name: '' }));
          }}
          error={errs.name}
        />
        <Input
          label="Slug"
          value={f.slug}
          onChange={(e) => {
            setF((s) => ({ ...s, slug: e.target.value, slugTouched: true }));
            setErrs((x) => ({ ...x, slug: '' }));
          }}
          error={errs.slug}
          hint={
            editing
              ? 'Đổi tên không đổi slug. Sửa ô này nếu muốn đổi đường dẫn.'
              : 'Tự sinh từ tên, có thể sửa'
          }
        />
        <UploadDropzone
          label="Logo"
          preview={f.logoUrl}
          onError={toast.error}
          onFiles={async ([file]) => {
            const u = await readAsDataUrl(file);
            setF((s) => ({ ...s, logoUrl: u }));
          }}
        />
        {f.logoUrl && (
          <Button variant="ghost" size="sm" onClick={() => setF((s) => ({ ...s, logoUrl: null }))}>
            Xóa logo
          </Button>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            aria-label="Đang hoạt động"
            checked={f.isActive}
            onChange={(e) => setF((s) => ({ ...s, isActive: e.target.checked }))}
            className="h-4 w-4 accent-primary"
          />
          Đang hoạt động (hiện trong ô chọn thương hiệu của sản phẩm)
        </label>
      </div>
    </Modal>
  );
}

export default function AdminBrandsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editing: BrandAdmin | null }>({
    open: false,
    editing: null,
  });
  const [del, setDel] = useState<BrandAdmin | null>(null);
  const q = useQuery({
    queryKey: ['admin', 'brands', search],
    queryFn: () => adminApi.brands.list({ q: search }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.brands.remove(id),
    onSuccess: (r) => {
      toast.success(
        r.productsDetached
          ? `Đã xóa thương hiệu; ${r.productsDetached} sản phẩm không còn thương hiệu.`
          : 'Đã xóa thương hiệu.',
      );
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      qc.invalidateQueries({ queryKey: ['brands'] });
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      setDel(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: Column<BrandAdmin>[] = [
    {
      key: 'logo',
      header: 'Logo',
      render: (b) => (
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-surface-muted">
          {b.logoUrl ? (
            <img src={b.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <Icon name="tag" size={16} />
          )}
        </span>
      ),
    },
    { key: 'name', header: 'Tên thương hiệu', render: (b) => <b>{b.name}</b> },
    { key: 'slug', header: 'Slug', render: (b) => <code className="text-xs text-muted">{b.slug}</code> },
    { key: 'count', header: 'Số sản phẩm', render: (b) => b.productCount },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (b) => (
        <StatusBadge
          info={b.isActive ? { label: 'Hoạt động', tone: 'green' } : { label: 'Đã tắt', tone: 'red' }}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Thương hiệu"
        description="Quản lý thương hiệu sản phẩm và logo."
        actions={
          <Button onClick={() => setModal({ open: true, editing: null })}>
            <Icon name="plus" size={16} /> Thêm thương hiệu
          </Button>
        }
      />
      <input
        className="field mb-4 max-w-sm"
        placeholder="Tìm theo tên thương hiệu…"
        aria-label="Tìm thương hiệu"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DataTable
        columns={columns}
        rows={q.data}
        rowKey={(b) => b.id}
        loading={q.isLoading}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        unit="thương hiệu"
        actions={[
          { label: 'Sửa', onClick: (b) => setModal({ open: true, editing: b }) },
          { label: 'Xóa', danger: true, onClick: setDel },
        ]}
      />
      <BrandModal
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
      />
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa thương hiệu"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Xóa thương hiệu
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Bạn chắc chắn muốn xóa thương hiệu <b>{del?.name}</b>?
        </p>
        {del && del.productCount > 0 && (
          <p role="alert" className="mt-3 rounded-btn bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Thương hiệu đang có <b>{del.productCount} sản phẩm</b>. Sau khi xóa, các sản phẩm này sẽ không còn
            thương hiệu (không bị xóa).
          </p>
        )}
      </Modal>
    </div>
  );
}
