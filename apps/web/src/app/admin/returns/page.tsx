'use client';

// Quản lý đổi trả (WIREFRAME 7.19): bảng + panel chi tiết bên phải
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';
import FilterBar, { PageHeader } from '@/components/admin/FilterBar';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Input';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import { useDebounced, useListState } from '@/hooks/useListState';
import { downloadCsv } from '@/lib/csv';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { returnReasonLabel, returnStatusInfo } from '@/lib/status';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { ReturnRequest } from '@/types/api';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'picking', label: 'Đang lấy hàng' },
  { key: 'inspecting', label: 'Đang kiểm tra' },
  { key: 'refunded', label: 'Đã hoàn tiền' },
  { key: 'rejected', label: 'Từ chối' },
] as const;

export default function AdminReturnsPage() {
  const qc = useQueryClient();
  const [st, patch] = useListState({ q: '', page: 1, sort: '', status: '', type: '' });
  const q = useDebounced(st.q);
  const [selId, setSelId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'returns', q, st.page, st.status, st.type],
    queryFn: () => adminApi.returns.list({ q, page: st.page, pageSize: 8, status: st.status, type: st.type }),
  });
  const sel = list.data?.items.find((r) => r.id === selId) ?? null;
  useEffect(() => setNote(sel?.adminNote ?? ''), [sel?.id, sel?.status]);

  const act = useMutation({
    mutationFn: (status: ReturnRequest['status']) =>
      adminApi.returns.update(sel!.id, { status, adminNote: note }),
    onSuccess: (r) => {
      toast.success(`Đã cập nhật yêu cầu ${r.code}.`);
      qc.invalidateQueries({ queryKey: ['admin', 'returns'] });
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['admin', 'finance'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: Column<ReturnRequest>[] = [
    { key: 'code', header: 'Mã YC', render: (r) => <b>#{r.code}</b> },
    { key: 'cus', header: 'Khách hàng', render: (r) => r.customerName },
    {
      key: 'prod',
      header: 'Sản phẩm',
      render: (r) => (
        <span className="line-clamp-1 max-w-[160px]">
          {r.items[0]?.productName}
          {r.items.length > 1 ? ` +${r.items.length - 1}` : ''}
        </span>
      ),
    },
    { key: 'reason', header: 'Lý do', render: (r) => returnReasonLabel[r.reason] },
    { key: 'amount', header: 'Số tiền', render: (r) => <b>{formatCurrency(r.refundAmount)}</b> },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge info={returnStatusInfo[r.status]} /> },
  ];

  const exportCsv = () =>
    downloadCsv('doi-tra.csv', [
      ['Mã YC', 'Đơn hàng', 'Khách hàng', 'Hình thức', 'Lý do', 'Số tiền', 'Trạng thái', 'Ngày gửi'],
      ...(list.data?.items ?? []).map((r) => [
        r.code,
        r.orderCode,
        r.customerName,
        r.type === 'refund' ? 'Trả hàng & hoàn tiền' : 'Đổi sản phẩm',
        returnReasonLabel[r.reason],
        r.refundAmount,
        returnStatusInfo[r.status].label,
        formatDateTime(r.createdAt),
      ]),
    ]);

  return (
    <div>
      <PageHeader
        title="Đổi trả"
        description="Duyệt và xử lý yêu cầu đổi trả, hoàn tiền của khách hàng."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Icon name="download" size={16} /> Xuất Excel
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={st.status as (typeof TABS)[number]['key']}
        onChange={(k) => {
          patch({ status: k });
          setSelId(null);
        }}
      />
      <FilterBar
        search={{
          value: st.q,
          onChange: (v) => patch({ q: v }),
          placeholder: 'Tìm theo mã yêu cầu, khách hàng, đơn hàng…',
        }}
        selects={[
          {
            key: 'type',
            placeholder: 'Tất cả hình thức',
            value: st.type,
            onChange: (v) => patch({ type: v }),
            options: [
              { value: 'refund', label: 'Trả hàng & hoàn tiền' },
              { value: 'exchange', label: 'Đổi sản phẩm' },
            ],
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          error={list.isError ? errorMessage(list.error) : null}
          onRetry={() => list.refetch()}
          onRowClick={(r) => setSelId(r.id)}
          activeRowKey={selId}
          page={list.data?.meta.page ?? st.page}
          pageSize={8}
          total={list.data?.meta.total}
          onPage={(p) => patch({ page: p })}
          unit="yêu cầu"
          actions={[{ label: 'Xem chi tiết', onClick: (r) => setSelId(r.id) }]}
        />
        <aside className="card h-fit p-5 text-sm xl:sticky xl:top-20">
          {!sel ? (
            <p className="py-10 text-center text-muted">Chọn một yêu cầu để xem chi tiết.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold">#{sel.code}</p>
                  <p className="text-xs text-muted">
                    Gửi {formatDateTime(sel.createdAt)} · Đơn {sel.orderCode}
                  </p>
                </div>
                <StatusBadge info={returnStatusInfo[sel.status]} />
              </div>
              <ul className="space-y-2">
                {sel.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-btn bg-surface-muted/50 p-2">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white">
                      {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-semibold">{it.productName}</span>
                      <span className="text-xs text-muted">
                        {it.variantLabel} · x{it.quantity}
                      </span>
                    </span>
                    <b>{formatCurrency(it.unitPrice * it.quantity)}</b>
                  </li>
                ))}
              </ul>
              <div>
                <p className="font-semibold">
                  {sel.type === 'refund' ? 'Trả hàng & hoàn tiền' : 'Đổi sản phẩm khác'} ·{' '}
                  {returnReasonLabel[sel.reason]}
                </p>
                <p className="mt-1 text-muted">{sel.description}</p>
              </div>
              {sel.images.length > 0 && (
                <div className="flex gap-2">
                  {sel.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Minh chứng ${i + 1}`}
                      className="h-16 w-16 rounded-md border border-line object-cover"
                    />
                  ))}
                </div>
              )}
              {!['refunded', 'exchanged', 'rejected'].includes(sel.status) ? (
                <>
                  <Textarea
                    label="Phản hồi cho khách"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nhập phản hồi (bắt buộc khi từ chối)…"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      loading={act.isPending && act.variables === 'rejected'}
                      onClick={() => act.mutate('rejected')}
                    >
                      Từ chối
                    </Button>
                    {sel.status === 'pending' && (
                      <Button
                        size="sm"
                        loading={act.isPending && act.variables === 'picking'}
                        onClick={() => act.mutate('picking')}
                      >
                        Duyệt & tạo lệnh lấy hàng
                      </Button>
                    )}
                    {sel.status === 'picking' && (
                      <Button size="sm" loading={act.isPending} onClick={() => act.mutate('inspecting')}>
                        Đã nhận hàng – kiểm tra
                      </Button>
                    )}
                    {sel.status === 'inspecting' && (
                      <Button
                        size="sm"
                        loading={act.isPending}
                        onClick={() => act.mutate(sel.type === 'refund' ? 'refunded' : 'exchanged')}
                      >
                        {sel.type === 'refund' ? 'Xác nhận hoàn tiền' : 'Xác nhận đổi hàng'}
                      </Button>
                    )}
                  </div>
                  {sel.status === 'inspecting' && (
                    <p className="text-xs text-muted">
                      Hoàn tiền sẽ tự tạo phiếu chi (Hoàn tiền) và cộng lại tồn kho.
                    </p>
                  )}
                </>
              ) : sel.adminNote ? (
                <p className="rounded-btn bg-surface-muted/60 p-3">
                  <b>Phản hồi:</b> {sel.adminNote}
                </p>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
