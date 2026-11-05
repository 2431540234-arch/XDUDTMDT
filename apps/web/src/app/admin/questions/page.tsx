'use client';

// Quản lý hỏi đáp (WIREFRAME 7.24)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import { Checkbox, Textarea } from '@/components/ui/Input';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import { useDebounced, useListState } from '@/hooks/useListState';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { ProductQuestion } from '@/types/api';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'unanswered', label: 'Chưa trả lời' },
  { key: 'answered', label: 'Đã trả lời' },
  { key: 'hidden', label: 'Ẩn' },
] as const;
const STATUS = {
  unanswered: { label: 'Chưa trả lời', tone: 'orange' },
  answered: { label: 'Đã trả lời', tone: 'green' },
  hidden: { label: 'Ẩn', tone: 'red' },
} as const;

export default function AdminQuestionsPage() {
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: '', status: '' });
  const q = useDebounced(st.q);
  const [selId, setSelId] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [pub, setPub] = useState(true);
  const [notify, setNotify] = useState(true);
  const list = useQuery({
    queryKey: ['admin', 'questions', q, st.page, st.status],
    queryFn: () => adminApi.questions.list({ q, page: st.page, pageSize: 8, status: st.status }),
  });
  const sel = list.data?.items.find((x) => x.id === selId) ?? null;
  useEffect(() => {
    setAnswer(sel?.answer ?? '');
    setPub(sel?.isPublic ?? true);
  }, [sel?.id]);
  const done = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'questions'] });
    qc.invalidateQueries({ queryKey: ['questions'] });
  };
  const reply = useMutation({
    mutationFn: () => adminApi.questions.answer(sel!.id, { answer, isPublic: pub }),
    onSuccess: () => {
      toast.success(notify ? 'Đã gửi trả lời và thông báo cho khách.' : 'Đã gửi trả lời.');
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const hide = useMutation({
    mutationFn: () => adminApi.questions.hide(sel!.id),
    onSuccess: () => {
      toast.success('Đã ẩn câu hỏi.');
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: Column<ProductQuestion>[] = [
    {
      key: 'p',
      header: 'Sản phẩm',
      render: (x) => <span className="line-clamp-1 max-w-[150px] font-semibold">{x.productName}</span>,
    },
    { key: 'u', header: 'Khách hàng', render: (x) => x.userName },
    {
      key: 'q',
      header: 'Câu hỏi',
      render: (x) => <span className="line-clamp-2 max-w-[260px] text-muted">{x.content}</span>,
    },
    { key: 's', header: 'Trạng thái', render: (x) => <StatusBadge info={STATUS[x.status]} /> },
  ];
  return (
    <div>
      <PageHeader title="Hỏi đáp" description="Trả lời câu hỏi của khách hàng về sản phẩm." />
      <Tabs
        className="mb-4"
        value={st.status as (typeof TABS)[number]['key']}
        onChange={(k) => {
          patch({ status: k });
          setSelId(null);
        }}
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo sản phẩm, khách hàng, nội dung…',
        }}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(x) => x.id}
          loading={list.isLoading}
          error={list.isError ? errorMessage(list.error) : null}
          onRetry={() => list.refetch()}
          onRowClick={(x) => setSelId(x.id)}
          activeRowKey={selId}
          page={list.data?.meta.page ?? st.page}
          pageSize={8}
          total={list.data?.meta.total}
          onPage={(p) => patch({ page: p })}
          unit="câu hỏi"
          actions={[{ label: 'Trả lời', onClick: (x) => setSelId(x.id) }]}
        />
        <aside className="card h-fit p-5 text-sm xl:sticky xl:top-20">
          {!sel ? (
            <p className="py-10 text-center text-muted">Chọn một câu hỏi để trả lời.</p>
          ) : (
            <div className="space-y-4">
              <h2 className="font-extrabold">Trả lời câu hỏi</h2>
              <div className="flex items-center gap-3 rounded-btn bg-surface-muted/50 p-2">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white">
                  {sel.productImageUrl && (
                    <img src={sel.productImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="font-semibold">{sel.productName}</span>
              </div>
              <div>
                <p className="text-xs text-muted">
                  {sel.userName} · {formatDateTime(sel.createdAt)}
                </p>
                <p className="mt-1 rounded-btn bg-primary-soft/50 p-3 font-medium">{sel.content}</p>
              </div>
              <Textarea
                label="Câu trả lời"
                required
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <Checkbox
                label="Hiển thị công khai (tab Hỏi đáp ở trang sản phẩm)"
                checked={pub}
                onChange={(e) => setPub(e.target.checked)}
              />
              <Checkbox
                label="Gửi thông báo cho khách"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sel.status === 'hidden'}
                  loading={hide.isPending}
                  onClick={() => hide.mutate()}
                >
                  Ẩn câu hỏi
                </Button>
                <Button size="sm" loading={reply.isPending} onClick={() => reply.mutate()}>
                  Gửi trả lời
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
