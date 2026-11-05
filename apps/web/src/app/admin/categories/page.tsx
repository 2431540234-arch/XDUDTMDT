'use client';

// Quản lý danh mục – bảng dạng cây (WIREFRAME 3.4) + modal thêm/sửa danh mục (7.21)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Checkbox, Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { slugify } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { CategoryNode } from '@/types/api';

interface FormState {
  name: string;
  slug: string;
  slugTouched: boolean;
  parentId: string;
  description: string;
  imageUrl: string | null;
  icon: string;
  sortOrder: string;
  isActive: boolean;
  isFeatured: boolean;
}
const EMPTY: FormState = {
  name: '',
  slug: '',
  slugTouched: false,
  parentId: '',
  description: '',
  imageUrl: null,
  icon: '',
  sortOrder: '',
  isActive: true,
  isFeatured: false,
};

function CategoryModal({
  open,
  onClose,
  editing,
  roots,
  presetParent,
}: {
  open: boolean;
  onClose: () => void;
  editing: CategoryNode | null;
  roots: CategoryNode[];
  presetParent?: number | null;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(EMPTY);
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
            parentId: String(editing.parentId ?? ''),
            description: editing.description ?? '',
            imageUrl: editing.imageUrl,
            icon: '',
            sortOrder: String(editing.sortOrder),
            isActive: editing.isActive,
            isFeatured: Boolean(editing.isFeatured),
          }
        : { ...EMPTY, parentId: presetParent ? String(presetParent) : '' },
    );
  }, [open, editing, presetParent]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v, ...(k === 'name' && !s.slugTouched ? { slug: slugify(String(v)) } : {}) }));
    setErrs((e) => ({ ...e, [k]: '' }));
  };
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name,
        slug: f.slug,
        parentId: f.parentId ? Number(f.parentId) : null,
        description: f.description,
        imageUrl: f.imageUrl,
        sortOrder: Number(f.sortOrder) || undefined,
        isActive: f.isActive,
        isFeatured: f.isFeatured,
      };
      return editing ? adminApi.categories.update(editing.id, body) : adminApi.categories.create(body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.');
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else toast.error(errorMessage(e));
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (f.name.trim().length < 2) x.name = 'Vui lòng nhập tên danh mục.';
    setErrs(x);
    if (!Object.keys(x).length) save.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Sửa danh mục' : 'Thêm danh mục'}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Lưu danh mục
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Tên danh mục"
          required
          value={f.name}
          onChange={(e) => set('name', e.target.value)}
          error={errs.name}
        />
        <Input
          label="Slug"
          value={f.slug}
          onChange={(e) => {
            set('slug', e.target.value);
            setF((s) => ({ ...s, slugTouched: true }));
          }}
          error={errs.slug}
          hint="Tự sinh từ tên, có thể sửa"
        />
        <Select
          label="Danh mục cha"
          placeholder="— Không (cấp 1) —"
          value={f.parentId}
          onChange={(e) => set('parentId', e.target.value)}
          error={errs.parentId}
          options={roots.filter((r) => r.id !== editing?.id).map((r) => ({ value: r.id, label: r.name }))}
        />
        <Input
          label="Thứ tự hiển thị"
          inputMode="numeric"
          value={f.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value.replace(/\D/g, ''))}
        />
        <Textarea
          wrapperClassName="sm:col-span-2"
          label="Mô tả"
          rows={2}
          value={f.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className="sm:col-span-2">
          <UploadDropzone
            label="Ảnh đại diện"
            preview={f.imageUrl}
            onError={toast.error}
            onFiles={async ([file]) => set('imageUrl', await readAsDataUrl(file))}
          />
        </div>
        <Textarea
          wrapperClassName="sm:col-span-2"
          label="Icon SVG (tùy chọn)"
          rows={2}
          placeholder="<svg …>…</svg>"
          value={f.icon}
          onChange={(e) => set('icon', e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <span className="relative inline-flex h-6 w-11 items-center">
              <input
                type="checkbox"
                role="switch"
                aria-label="Trạng thái hoạt động"
                className="peer sr-only"
                checked={f.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span className="absolute inset-0 rounded-full bg-line transition peer-checked:bg-primary" />
              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
            </span>
            Trạng thái: {f.isActive ? 'Hoạt động' : 'Ẩn'}
          </label>
          <Checkbox
            label="Hiện ở “Danh mục nổi bật” trang chủ"
            checked={f.isFeatured}
            onChange={(e) => set('isFeatured', e.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories.tree });
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [modal, setModal] = useState<{
    open: boolean;
    editing: CategoryNode | null;
    parentId?: number | null;
  }>({ open: false, editing: null });
  const [del, setDel] = useState<CategoryNode | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.categories.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa danh mục.');
      setDel(null);
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDel(null);
    },
  });
  const rows = useMemo(
    () => (q.data ?? []).flatMap((r) => [r, ...(collapsed.includes(r.id) ? [] : r.children)]),
    [q.data, collapsed],
  );

  const columns: Column<CategoryNode>[] = [
    {
      key: 'name',
      header: 'Tên danh mục',
      render: (c) => (
        <span className="flex items-center gap-2" style={{ paddingLeft: c.parentId ? 28 : 0 }}>
          {!c.parentId && c.children.length > 0 ? (
            <button
              type="button"
              aria-label={collapsed.includes(c.id) ? 'Mở rộng' : 'Thu gọn'}
              aria-expanded={!collapsed.includes(c.id)}
              onClick={() =>
                setCollapsed((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
              }
              className="rounded p-0.5 hover:bg-surface-muted"
            >
              <Icon name={collapsed.includes(c.id) ? 'chevronRight' : 'chevronDown'} size={16} />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Icon name="folder" size={18} className="text-primary" />
          <span className={c.parentId ? '' : 'font-bold'}>{c.name}</span>
        </span>
      ),
    },
    { key: 'slug', header: 'Slug', render: (c) => <code className="text-xs text-muted">{c.slug}</code> },
    { key: 'parent', header: 'Danh mục cha', render: (c) => c.parentName ?? '—' },
    { key: 'count', header: 'Số sản phẩm', render: (c) => c.productCount },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (c) => (
        <StatusBadge
          info={
            c.isActive ? { label: 'Hoạt động', tone: 'green' } : { label: 'Không hoạt động', tone: 'red' }
          }
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Danh mục"
        description="Quản lý danh mục sản phẩm (tối đa 2 cấp)."
        actions={
          <Button onClick={() => setModal({ open: true, editing: null })}>
            <Icon name="plus" size={16} /> Thêm danh mục
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={q.isLoading ? undefined : rows}
        rowKey={(c) => c.id}
        loading={q.isLoading}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        unit="danh mục"
        actions={[
          { label: 'Sửa', onClick: (c) => setModal({ open: true, editing: c }) },
          {
            label: 'Thêm danh mục con',
            hidden: (c) => Boolean(c.parentId),
            onClick: (c) => setModal({ open: true, editing: null, parentId: c.id }),
          },
          { label: 'Xóa', danger: true, onClick: setDel },
        ]}
      />
      <CategoryModal
        open={modal.open}
        editing={modal.editing}
        presetParent={modal.parentId}
        roots={q.data ?? []}
        onClose={() => setModal({ open: false, editing: null })}
      />
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa danh mục"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Bạn chắc chắn muốn xóa danh mục <b>{del?.name}</b>? Danh mục đang có sản phẩm hoặc danh mục con sẽ
          không xóa được.
        </p>
      </Modal>
    </div>
  );
}
