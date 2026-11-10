'use client';

// Quản lý nội dung (WIREFRAME 7.25): Banner & slider · Bài viết/Blog · Trang tĩnh · Menu & footer
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/FilterBar';
import UploadDropzone, { readAsDataUrl } from '@/components/admin/UploadDropzone';
import Button, { LinkButton } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { toInputDate } from '@/lib/date';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { ApiClientError } from '@/services/api-client';
import { toast } from '@/store/uiStore';
import type { Banner, Post } from '@/types/api';

type Tab = 'banners' | 'posts' | 'pages' | 'menu';
const POSITIONS: Array<[Banner['position'], string]> = [
  ['hero-1', 'Slider chính – slide 1'],
  ['hero-2', 'Slider chính – slide 2'],
  ['hero-3', 'Slider chính – slide 3'],
  ['home-left', 'Giữa trang – trái'],
  ['home-right', 'Giữa trang – phải'],
  ['home-3d', 'Banner 3D'],
];

function bannerState(b: Banner): { label: string; tone: 'green' | 'yellow' | 'red' } {
  const now = new Date();
  if (!b.isActive) return { label: 'Ẩn', tone: 'red' };
  if (new Date(b.startAt) > now) return { label: 'Đã lên lịch', tone: 'yellow' };
  if (b.endAt && new Date(b.endAt) < now) return { label: 'Ẩn', tone: 'red' };
  return { label: 'Đang hiển thị', tone: 'green' };
}

function BannerModal({
  banner,
  open,
  onClose,
}: {
  banner: Banner | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: '',
    subtitle: '',
    link: '/',
    position: 'hero-1' as Banner['position'],
    startAt: toInputDate(new Date()),
    endAt: '',
    imageUrl: '' as string | null,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setErrs({});
      setF(
        banner
          ? {
              title: banner.title,
              subtitle: banner.subtitle ?? '',
              link: banner.link,
              position: banner.position,
              startAt: banner.startAt.slice(0, 10),
              endAt: banner.endAt?.slice(0, 10) ?? '',
              imageUrl: banner.imageUrl,
            }
          : {
              title: '',
              subtitle: '',
              link: '/',
              position: 'hero-1',
              startAt: toInputDate(new Date()),
              endAt: '',
              imageUrl: null,
            },
      );
    }
  }, [open, banner]);
  const save = useMutation({
    mutationFn: () =>
      adminApi.content.saveBanner({
        id: banner?.id,
        title: f.title,
        subtitle: f.subtitle,
        link: f.link,
        position: f.position,
        startAt: new Date(f.startAt).toISOString(),
        endAt: f.endAt ? new Date(f.endAt).toISOString() : null,
        imageUrl: f.imageUrl ?? undefined,
      }),
    onSuccess: () => {
      toast.success('Đã lưu banner.');
      qc.invalidateQueries({ queryKey: ['admin', 'banners'] });
      qc.invalidateQueries({ queryKey: ['banners'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (f.title.trim().length < 2) x.title = 'Vui lòng nhập tiêu đề.';
    if (!f.imageUrl) x.imageUrl = 'Vui lòng tải ảnh banner.';
    setErrs(x);
    if (!Object.keys(x).length) save.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={banner ? 'Sửa banner' : 'Thêm banner'}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Lưu banner
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          wrapperClassName="sm:col-span-2"
          label="Tiêu đề"
          required
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          error={errs.title}
        />
        <Input
          wrapperClassName="sm:col-span-2"
          label="Mô tả ngắn"
          value={f.subtitle}
          onChange={(e) => setF({ ...f, subtitle: e.target.value })}
        />
        <Select
          label="Vị trí"
          value={f.position}
          onChange={(e) => setF({ ...f, position: e.target.value as Banner['position'] })}
          options={POSITIONS.map(([value, label]) => ({ value, label }))}
        />
        <Input label="Liên kết" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        <Input
          label="Bắt đầu hiển thị"
          type="date"
          value={f.startAt}
          onChange={(e) => setF({ ...f, startAt: e.target.value })}
        />
        <Input
          label="Kết thúc"
          type="date"
          value={f.endAt}
          onChange={(e) => setF({ ...f, endAt: e.target.value })}
          hint="Để trống = không giới hạn"
        />
        <div className="sm:col-span-2">
          <UploadDropzone
            label="Ảnh banner"
            preview={f.imageUrl}
            maxMB={5}
            onError={toast.error}
            onFiles={async ([file]) => setF({ ...f, imageUrl: await readAsDataUrl(file) })}
          />
          {errs.imageUrl && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errs.imageUrl}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Banners() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'banners'], queryFn: adminApi.content.banners });
  const [modal, setModal] = useState<{ open: boolean; banner: Banner | null }>({ open: false, banner: null });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'banners'] });
    qc.invalidateQueries({ queryKey: ['banners'] });
  };
  const toggle = useMutation({
    mutationFn: (b: Banner) =>
      adminApi.content.saveBanner({ id: b.id, title: b.title, isActive: !b.isActive }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.content.removeBanner(id),
    onSuccess: () => {
      toast.success('Đã xóa banner.');
      invalidate();
    },
  });
  const move = useMutation({
    mutationFn: ({ b, d }: { b: Banner; d: number }) =>
      adminApi.content.saveBanner({ id: b.id, title: b.title, sortOrder: b.sortOrder + d }),
    onSuccess: invalidate,
  });
  if (q.isLoading) return <Skeleton className="h-60 w-full" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">Banner trang chủ</h2>
        <Button size="sm" onClick={() => setModal({ open: true, banner: null })}>
          <Icon name="plus" size={15} /> Thêm banner
        </Button>
      </div>
      {q.data?.length ? (
        <ul className="divide-y divide-line">
          {q.data.map((b) => {
            const s = bannerState(b);
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-muted" aria-hidden>
                  <Icon name="drag" size={18} />
                </span>
                <img src={b.imageUrl} alt="" className="h-14 w-24 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.title}</p>
                  <p className="text-xs text-muted">
                    {POSITIONS.find((p) => p[0] === b.position)?.[1]} · {formatDate(b.startAt)} –{' '}
                    {b.endAt ? formatDate(b.endAt) : '∞'}
                  </p>
                </div>
                <StatusBadge label={s.label} tone={s.tone} />
                <span className="flex">
                  <button
                    type="button"
                    aria-label="Lên"
                    className="p-1.5 hover:text-primary"
                    onClick={() => move.mutate({ b, d: -1 })}
                  >
                    <Icon name="chevronUp" size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Xuống"
                    className="p-1.5 hover:text-primary"
                    onClick={() => move.mutate({ b, d: 1 })}
                  >
                    <Icon name="chevronDown" size={16} />
                  </button>
                </span>
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Hiển thị ${b.title}`}
                    checked={b.isActive}
                    onChange={() => toggle.mutate(b)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, banner: b })}>
                  Sửa
                </Button>
                <button
                  type="button"
                  aria-label="Xóa banner"
                  className="p-1.5 text-muted hover:text-danger"
                  onClick={() => remove.mutate(b.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="image" title="Chưa có banner" />
      )}
      <BannerModal
        open={modal.open}
        banner={modal.banner}
        onClose={() => setModal({ open: false, banner: null })}
      />
    </section>
  );
}

function PostModal({ post, open, onClose }: { post: Post | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: '',
    category: 'Cảm hứng',
    content: '',
    status: 'draft' as Post['status'],
  });
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) {
      setErr('');
      setF(
        post
          ? { title: post.title, category: post.category, content: post.content, status: post.status }
          : { title: '', category: 'Cảm hứng', content: '', status: 'draft' },
      );
    }
  }, [open, post]);
  const save = useMutation({
    mutationFn: () => adminApi.content.savePost({ id: post?.id, ...f }),
    onSuccess: () => {
      toast.success('Đã lưu bài viết.');
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={post ? 'Sửa bài viết' : 'Viết bài mới'}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => (f.title.trim().length < 5 ? setErr('Tiêu đề tối thiểu 5 ký tự.') : save.mutate())}
          >
            Lưu bài viết
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Tiêu đề"
          required
          value={f.title}
          onChange={(e) => {
            setF({ ...f, title: e.target.value });
            setErr('');
          }}
          error={err}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Chuyên mục"
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
            options={['Cảm hứng', 'Mẹo chọn nội thất', 'Xu hướng', 'Bảo quản', 'Hướng dẫn'].map((x) => ({
              value: x,
              label: x,
            }))}
          />
          <Select
            label="Trạng thái"
            value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value as Post['status'] })}
            options={[
              { value: 'published', label: 'Đã xuất bản' },
              { value: 'draft', label: 'Bản nháp' },
            ]}
          />
        </div>
        <Textarea
          label="Nội dung"
          rows={8}
          value={f.content}
          onChange={(e) => setF({ ...f, content: e.target.value })}
        />
      </div>
    </Modal>
  );
}

function Posts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'posts'], queryFn: adminApi.content.posts });
  const [modal, setModal] = useState<{ open: boolean; post: Post | null }>({ open: false, post: null });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.content.removePost(id),
    onSuccess: () => {
      toast.success('Đã xóa bài viết.');
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
    },
  });
  if (q.isLoading) return <Skeleton className="h-60 w-full" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">Bài viết gần đây</h2>
        <Button size="sm" onClick={() => setModal({ open: true, post: null })}>
          <Icon name="plus" size={15} /> Viết bài mới
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Tiêu đề</th>
              <th>Chuyên mục</th>
              <th>Tác giả</th>
              <th>Ngày</th>
              <th>Lượt xem</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {q.data?.map((p) => (
              <tr key={p.id}>
                <td className="py-2.5">
                  <span className="flex items-center gap-3">
                    <img src={p.coverUrl} alt="" className="h-10 w-14 rounded object-cover" />
                    <span className="line-clamp-2 max-w-[260px] font-semibold">{p.title}</span>
                  </span>
                </td>
                <td>{p.category}</td>
                <td>{p.authorName}</td>
                <td>{formatDate(p.publishedAt ?? p.createdAt)}</td>
                <td>{p.views.toLocaleString('vi-VN')}</td>
                <td>
                  <StatusBadge
                    label={p.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                    tone={p.status === 'published' ? 'green' : 'yellow'}
                  />
                </td>
                <td className="whitespace-nowrap text-right">
                  <button
                    type="button"
                    className="px-2 text-sm font-semibold text-primary hover:underline"
                    onClick={() => setModal({ open: true, post: p })}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    aria-label="Xóa bài viết"
                    className="p-1.5 text-muted hover:text-danger"
                    onClick={() => remove.mutate(p.id)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PostModal open={modal.open} post={modal.post} onClose={() => setModal({ open: false, post: null })} />
    </section>
  );
}

/** Trang hệ thống: BE không cho xóa (CORE_PAGES ở admin-content.service.ts) */
const CORE_PAGE_SLUGS = [
  'about',
  've-chung-toi',
  'chinh-sach-mua-hang',
  'chinh-sach-doi-tra',
  'chinh-sach-bao-hanh',
  'chinh-sach-bao-mat',
  'dieu-khoan-su-dung',
  'chinh-sach-van-chuyen',
];

interface PageForm {
  id: number | null; // null = tạo mới
  title: string;
  slug: string;
  type: 'static' | 'policy';
  content: string;
  status: string;
}

function Pages() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'pages'], queryFn: adminApi.content.pages });
  const [edit, setEdit] = useState<PageForm | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [del, setDel] = useState<{ id: number; title: string } | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'pages'] });
    qc.invalidateQueries({ queryKey: ['page'] });
  };
  const save = useMutation({
    mutationFn: (f: PageForm) =>
      f.id
        ? adminApi.content.savePage(f.id, { title: f.title, content: f.content, status: f.status })
        : adminApi.content.createPage({
            title: f.title,
            slug: f.slug.trim() || undefined,
            type: f.type,
            content: f.content,
            status: f.status,
          }),
    onSuccess: (_r, f) => {
      toast.success(f.id ? 'Đã lưu trang.' : 'Đã tạo trang.');
      setEdit(null);
      setErrs({});
      refresh();
    },
    onError: (e) => {
      // lỗi theo trường (400 VALIDATION_FAILED / 409 slug trùng) hiện ngay dưới ô nhập
      const fe = e instanceof ApiClientError ? e.fieldErrors() : {};
      if (Object.keys(fe).length) setErrs(fe);
      else toast.error(errorMessage(e));
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.content.removePage(id),
    onSuccess: () => {
      toast.success('Đã xóa trang.');
      setDel(null);
      refresh();
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDel(null);
    },
  });
  const openNew = () => {
    setErrs({});
    setEdit({ id: null, title: '', slug: '', type: 'static', content: '', status: 'draft' });
  };
  if (q.isLoading) return <Skeleton className="h-60 w-full" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const where = (p: { slug: string; type?: string }) =>
    p.slug === 've-chung-toi' || p.slug === 'about' ? '/about' : `/policies/${p.slug}`;
  return (
    <section className="card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Trang tĩnh</h2>
        <Button size="sm" onClick={openNew}>
          <Icon name="plus" size={14} /> Tạo trang
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted">
        Về chúng tôi, các chính sách và điều khoản (hiển thị tại /about và /policies/…). Trang mới hiển thị
        tại /policies/&lt;slug&gt; khi đã xuất bản. FAQ & liên hệ được cố định theo mẫu.
      </p>
      <ul className="divide-y divide-line">
        {q.data?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="text-xs text-muted">
                {where(p)} · cập nhật {formatDate(p.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                label={p.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                tone={p.status === 'published' ? 'green' : 'yellow'}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setErrs({});
                  setEdit({
                    id: p.id,
                    title: p.title,
                    slug: p.slug,
                    type: 'static',
                    content: p.content ?? '',
                    status: p.status,
                  });
                }}
              >
                Sửa nội dung
              </Button>
              {!CORE_PAGE_SLUGS.includes(p.slug) && (
                <button
                  type="button"
                  aria-label={`Xóa trang ${p.title}`}
                  className="p-1.5 text-muted hover:text-danger"
                  onClick={() => setDel({ id: p.id, title: p.title })}
                >
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Sửa trang tĩnh' : 'Tạo trang tĩnh'}
        width={720}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Hủy
            </Button>
            <Button loading={save.isPending} onClick={() => edit && save.mutate(edit)}>
              {edit?.id ? 'Lưu trang' : 'Tạo trang'}
            </Button>
          </>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Input
              label="Tiêu đề"
              value={edit.title}
              error={errs.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
            {!edit.id && (
              <>
                <Input
                  label="Slug (đường dẫn)"
                  hint="Để trống để tự sinh từ tiêu đề"
                  value={edit.slug}
                  error={errs.slug}
                  onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
                />
                <Select
                  label="Loại trang"
                  value={edit.type}
                  onChange={(e) => setEdit({ ...edit, type: e.target.value as PageForm['type'] })}
                  options={[
                    { value: 'static', label: 'Trang tĩnh' },
                    { value: 'policy', label: 'Chính sách' },
                  ]}
                />
              </>
            )}
            <Textarea
              label="Nội dung (Markdown đơn giản: “## tiêu đề”, “- gạch đầu dòng”)"
              rows={12}
              value={edit.content}
              error={errs.content}
              onChange={(e) => setEdit({ ...edit, content: e.target.value })}
            />
            <Select
              label="Trạng thái"
              value={edit.status}
              error={errs.status}
              onChange={(e) => setEdit({ ...edit, status: e.target.value })}
              options={[
                { value: 'published', label: 'Đã xuất bản' },
                { value: 'draft', label: 'Bản nháp' },
              ]}
            />
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(del)}
        onClose={() => setDel(null)}
        title="Xóa trang"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Hủy
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Xóa trang
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Bạn có chắc muốn xóa trang <b>{del?.title}</b>? Trang sẽ biến mất khỏi website và không thể khôi
          phục.
        </p>
      </Modal>
    </section>
  );
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>('banners');
  return (
    <div className="space-y-5">
      <PageHeader
        title="Nội dung"
        description="Quản lý banner, bài viết và các trang tĩnh của website."
        actions={
          <LinkButton href="/" variant="outline">
            <Icon name="eye" size={16} /> Xem website
          </LinkButton>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'banners', label: 'Banner & slider' },
          { key: 'posts', label: 'Bài viết / Blog' },
          { key: 'pages', label: 'Trang tĩnh' },
          { key: 'menu', label: 'Menu & footer' },
        ]}
      />
      {tab === 'banners' && <Banners />}
      {tab === 'posts' && <Posts />}
      {tab === 'pages' && <Pages />}
      {tab === 'menu' && (
        <section className="card p-5 text-sm">
          <h2 className="mb-3 font-bold">Menu chính & footer</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold">Menu chính</p>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                <li>Trang chủ</li>
                <li>Sản phẩm</li>
                <li>Không gian mẫu</li>
                <li>Danh mục (tự sinh từ cây danh mục)</li>
                <li>Về chúng tôi</li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-semibold">Footer</p>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                <li>Liên kết nhanh · Chính sách · Hỗ trợ · Liên hệ</li>
                <li>Thông tin liên hệ lấy từ Cài đặt → Thông tin cửa hàng</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 rounded-btn bg-surface-muted/60 p-3 text-xs text-muted">
            Menu và footer hiện được cố định theo thiết kế; chỉnh sửa linh hoạt sẽ bổ sung khi backend có bảng
            cấu hình menu.
          </p>
        </section>
      )}
    </div>
  );
}
