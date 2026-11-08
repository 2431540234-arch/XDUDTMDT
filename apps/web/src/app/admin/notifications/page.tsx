'use client';

// UC-ADM-26 – Gửi thông báo cho người dùng (một hoặc nhiều người, hoặc tất cả). Khách thấy ở chuông như thông báo hệ thống.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import { useDebounced } from '@/hooks/useListState';
import { errorMessage } from '@/lib/validators';
import { ApiClientError } from '@/services/api-client';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';

export default function AdminSendNotificationPage() {
  const [target, setTarget] = useState<'pick' | 'all'>('pick');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [picked, setPicked] = useState<Array<{ id: number; fullName: string; email: string }>>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'system' | 'promo'>('system');
  const [link, setLink] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const found = useQuery({
    queryKey: ['admin', 'customers', 'pick', q],
    queryFn: () => adminApi.customers.list({ q, pageSize: 8 }),
    enabled: target === 'pick' && q.trim().length >= 2,
  });
  const send = useMutation({
    mutationFn: () =>
      adminApi.notify.send({
        title: title.trim(),
        content: content.trim(),
        type,
        ...(link.trim() ? { link: link.trim() } : {}),
        ...(target === 'all' ? { all: true } : { userIds: picked.map((p) => p.id) }),
      }),
    onSuccess: (r) => {
      toast.success(`Đã gửi thông báo tới ${r.sent} người dùng.`);
      setTitle('');
      setContent('');
      setLink('');
      setPicked([]);
      setErrs({});
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'VALIDATION_FAILED') setErrs(e.fieldErrors());
      else toast.error(errorMessage(e));
    },
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (title.trim().length < 2) x.title = 'Tiêu đề từ 2 đến 150 ký tự.';
    if (!content.trim()) x.content = 'Vui lòng nhập nội dung.';
    if (target === 'pick' && !picked.length) x.userIds = 'Vui lòng chọn người nhận.';
    setErrs(x);
    if (!Object.keys(x).length) send.mutate();
  };
  return (
    <div>
      <PageHeader
        title="Gửi thông báo"
        description="Gửi thông báo thủ công (khuyến mãi, bảo trì…) tới người dùng."
      />
      <div className="card max-w-3xl space-y-4 p-6">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Người nhận</legend>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="target"
                checked={target === 'pick'}
                onChange={() => setTarget('pick')}
              />{' '}
              Chọn khách hàng
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="target"
                checked={target === 'all'}
                onChange={() => setTarget('all')}
              />{' '}
              Tất cả người dùng
            </label>
          </div>
        </fieldset>
        {target === 'pick' && (
          <div>
            <Input
              label="Tìm khách hàng (tên, email, số điện thoại)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              error={errs.userIds}
            />
            {found.data && found.data.items.length > 0 && (
              <ul
                className="mt-2 divide-y divide-line rounded-btn border border-line text-sm"
                aria-label="Kết quả tìm kiếm"
              >
                {found.data.items.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface-muted disabled:opacity-50"
                      disabled={picked.some((p) => p.id === u.id)}
                      onClick={() =>
                        setPicked((cur) => [...cur, { id: u.id, fullName: u.fullName, email: u.email }])
                      }
                    >
                      <span>
                        {u.fullName} <span className="text-xs text-muted">{u.email}</span>
                      </span>
                      <span className="text-xs font-semibold text-primary">Thêm</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Người nhận đã chọn">
                {picked.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs"
                  >
                    {p.fullName}
                    <button
                      type="button"
                      aria-label={`Bỏ ${p.fullName}`}
                      className="font-bold text-primary"
                      onClick={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Input
          label="Tiêu đề"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          error={errs.title}
        />
        <Textarea
          label="Nội dung"
          rows={4}
          value={content}
          maxLength={2000}
          onChange={(e) => setContent(e.target.value)}
          error={errs.content}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Loại thông báo"
            value={type}
            onChange={(e) => setType(e.target.value as 'system' | 'promo')}
            options={[
              { value: 'system', label: 'Thông báo hệ thống' },
              { value: 'promo', label: 'Khuyến mãi' },
            ]}
          />
          <Input
            label="Liên kết (tùy chọn, vd. /products)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            error={errs.link}
          />
        </div>
        <Button loading={send.isPending} onClick={submit}>
          Gửi thông báo
        </Button>
      </div>
    </div>
  );
}
