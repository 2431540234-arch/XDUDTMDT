'use client';

// Thư viện media (UC-ADM-04): tải ảnh lên (≤ 5 MB), tìm kiếm, sửa mô tả (alt), xem nơi đang dùng, xóa
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone from '@/components/admin/UploadDropzone';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useDebounced } from '@/hooks/useListState';
import { formatDate } from '@/lib/format';
import { refreshAfterWrite } from '@/lib/query-refresh';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { MediaAdmin } from '@/types/api';

const size = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function AltModal({ media, onClose }: { media: MediaAdmin; onClose: () => void }) {
  const qc = useQueryClient();
  const [alt, setAlt] = useState(media.altText ?? '');
  const save = useMutation({
    mutationFn: () => adminApi.media.update(media.id, { altText: alt.trim() }),
    onSuccess: () => {
      toast.success('Đã lưu mô tả ảnh.');
      void refreshAfterWrite(qc, ['admin', 'media']);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Sửa mô tả ảnh"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} disabled={alt.length > 255} onClick={() => save.mutate()}>
            Lưu mô tả
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <img
          src={media.url}
          alt={media.altText ?? media.fileName}
          className="mx-auto max-h-40 rounded-md object-contain"
        />
        <Input
          label="Mô tả ảnh (alt)"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          error={alt.length > 255 ? 'Mô tả tối đa 255 ký tự.' : undefined}
          hint={`${alt.length}/255`}
        />
      </div>
    </Modal>
  );
}

export default function AdminMediaPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [unused, setUnused] = useState(false);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<MediaAdmin | null>(null);
  const [del, setDel] = useState<MediaAdmin | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => setPage(1), [q, unused]);
  const list = useQuery({
    queryKey: ['admin', 'media', q, unused, page],
    queryFn: () => adminApi.media.list({ q, page, pageSize: 12, ...(unused ? { usage: 'unused' } : {}) }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.media.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa tệp.');
      void refreshAfterWrite(qc, ['admin', 'media']);
      setDel(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e)); // 409: đang được sử dụng
      setDel(null);
    },
  });

  const upload = async (files: File[]) => {
    setUploading(true);
    let ok = 0;
    for (const f of files) {
      try {
        await adminApi.media.upload(f);
        ok++;
      } catch (e) {
        toast.error(`${f.name}: ${errorMessage(e)}`);
      }
    }
    setUploading(false);
    if (ok) {
      toast.success(ok === 1 ? 'Đã tải lên 1 tệp.' : `Đã tải lên ${ok} tệp.`);
      void refreshAfterWrite(qc, ['admin', 'media']);
      setPage(1);
    }
  };

  const items = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Thư viện media"
        description="Ảnh dùng chung cho sản phẩm, danh mục, thương hiệu, nội dung (≤ 5 MB, JPEG/PNG/WebP)."
      />
      <div className="mb-5">
        <UploadDropzone
          label="Tải ảnh lên"
          multiple
          maxMB={5}
          accept="image/png,image/jpeg,image/webp"
          hint="Kéo thả hoặc click để chọn nhiều ảnh – PNG, JPG, WebP (tối đa 5MB)"
          onError={toast.error}
          onFiles={upload}
        />
        {uploading && (
          <p role="status" className="mt-2 text-sm text-muted">
            Đang tải ảnh lên…
          </p>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="field max-w-sm"
          placeholder="Tìm theo tên tệp hoặc mô tả…"
          aria-label="Tìm media"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={unused}
            onChange={(e) => setUnused(e.target.checked)}
          />
          Chỉ tệp chưa được sử dụng
        </label>
        <span className="text-sm text-muted">{total} tệp</span>
      </div>

      {list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <p className="text-sm text-muted">Đang tải…</p>
      ) : items.length === 0 ? (
        <EmptyState icon="image" title="Chưa có tệp nào" />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Danh sách media">
          {items.map((m) => (
            <li key={m.id} className="card overflow-hidden" data-testid="media-card">
              <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted">
                <img src={m.url} alt={m.altText ?? m.fileName} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-1 p-3 text-sm">
                <p className="line-clamp-1 font-semibold" title={m.fileName}>
                  {m.fileName}
                </p>
                <p className="line-clamp-1 text-xs text-muted">{m.altText || 'Chưa có mô tả'}</p>
                <p className="text-xs text-muted">
                  {size(m.fileSize)} · {formatDate(m.createdAt)}
                </p>
                <p className="text-xs">
                  {m.usage.required + m.usage.optional > 0 ? (
                    <span className="rounded bg-primary-soft px-1.5 py-0.5 text-primary">
                      Đang dùng ({m.usage.required + m.usage.optional})
                    </span>
                  ) : (
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-muted">Chưa dùng</span>
                  )}
                </p>
                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Sao chép liên kết ${m.fileName}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(m.url);
                        toast.success('Đã sao chép liên kết.');
                      } catch {
                        toast.info(m.url);
                      }
                    }}
                  >
                    <Icon name="link" size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Sửa mô tả ${m.fileName}`}
                    onClick={() => setEdit(m)}
                  >
                    Sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Xóa ${m.fileName}`}
                    onClick={() => setDel(m)}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        className="mt-6"
        page={list.data?.meta.page ?? page}
        totalPages={list.data?.meta.totalPages ?? 1}
        onChange={setPage}
      />

      {edit && <AltModal media={edit} onClose={() => setEdit(null)} />}
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa tệp"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Xóa tệp
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Bạn chắc chắn muốn xóa <b>{del?.fileName}</b>?
        </p>
        {del && del.usage.required > 0 && (
          <p role="alert" className="mt-3 rounded-btn bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Tệp đang được sử dụng ở {del.usage.required} nơi (ảnh sản phẩm, không gian, mô hình…) nên sẽ không
            xóa được.
          </p>
        )}
        {del && del.usage.required === 0 && del.usage.optional > 0 && (
          <p role="alert" className="mt-3 rounded-btn bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Tệp đang là ảnh đại diện/logo ở {del.usage.optional} nơi; sau khi xóa các nơi này sẽ không còn
            ảnh.
          </p>
        )}
      </Modal>
    </div>
  );
}
