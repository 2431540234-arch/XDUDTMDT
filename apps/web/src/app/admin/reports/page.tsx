'use client';

// Báo cáo thu chi đầy đủ (WIREFRAME 7.28, thay cho 3.10)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard, { CHART_COLORS, DonutChart } from '@/components/admin/ChartCard';
import { PageHeader } from '@/components/admin/FilterBar';
import KpiCard from '@/components/admin/KpiCard';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { toInputDate } from '@/lib/date';
import { downloadCsv } from '@/lib/csv';
import { formatCompact, formatCurrency, formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';
import { toast } from '@/store/uiStore';
import type { Expense, FinanceReport } from '@/types/api';

type Tab = 'overview' | 'revenue' | 'expense' | 'ledger' | 'debt';
const CATS: Array<[Expense['category'], string]> = [
  ['cogs', 'Giá vốn hàng bán'],
  ['shipping', 'Vận chuyển & lắp đặt'],
  ['marketing', 'Marketing'],
  ['payment_fee', 'Phí cổng thanh toán'],
  ['refund', 'Hoàn tiền'],
  ['other', 'Chi phí khác'],
];
const fmtDay = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

function ExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    category: 'marketing' as Expense['category'],
    amount: '',
    date: toInputDate(new Date()),
    note: '',
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () =>
      adminApi.expenses.create({
        category: f.category,
        amount: Number(f.amount),
        note: f.note.trim(),
        date: new Date(f.date).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Đã thêm phiếu chi.');
      qc.invalidateQueries({ queryKey: ['admin', 'finance'] });
      setF({ ...f, amount: '', note: '' });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const x: Record<string, string> = {};
    if (!(Number(f.amount) > 0)) x.amount = 'Số tiền phải lớn hơn 0.';
    if (!f.note.trim()) x.note = 'Vui lòng nhập nội dung.';
    setErrs(x);
    if (!Object.keys(x).length) create.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm phiếu chi"
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Lưu phiếu chi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Danh mục"
          required
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value as Expense['category'] })}
          options={CATS.map(([value, label]) => ({ value, label }))}
        />
        <Input
          label="Số tiền (đ)"
          required
          inputMode="numeric"
          value={f.amount}
          onChange={(e) => {
            setF({ ...f, amount: e.target.value.replace(/\D/g, '') });
            setErrs({ ...errs, amount: '' });
          }}
          error={errs.amount}
        />
        <Input
          label="Ngày chi"
          type="date"
          value={f.date}
          onChange={(e) => setF({ ...f, date: e.target.value })}
        />
        <Textarea
          label="Nội dung"
          required
          rows={3}
          value={f.note}
          onChange={(e) => {
            setF({ ...f, note: e.target.value });
            setErrs({ ...errs, note: '' });
          }}
          error={errs.note}
        />
      </div>
    </Modal>
  );
}

function Ledger({
  rows,
  pageSize = 10,
  paginated,
}: {
  rows: FinanceReport['ledger'];
  pageSize?: number;
  paginated?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const shown = paginated ? rows.slice((page - 1) * pageSize, page * pageSize) : rows.slice(0, pageSize);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Ngày</th>
              <th>Mã GD</th>
              <th>Nội dung</th>
              <th>Loại</th>
              <th>Danh mục</th>
              <th className="text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.code + r.date}>
                <td className="whitespace-nowrap py-2.5">{formatDate(r.date)}</td>
                <td className="font-mono text-xs">{r.code}</td>
                <td className="max-w-[280px] truncate">{r.content}</td>
                <td>
                  <StatusBadge
                    label={r.type === 'income' ? 'Thu' : 'Chi'}
                    tone={r.type === 'income' ? 'green' : 'red'}
                  />
                </td>
                <td>{r.category}</td>
                <td
                  className={`text-right font-semibold ${r.amount >= 0 ? 'text-emerald-600' : 'text-danger'}`}
                >
                  {r.amount >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(r.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginated && <Pagination className="mt-4" page={page} totalPages={pages} onChange={setPage} />}
    </div>
  );
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState(
    toInputDate(new Date().getFullYear() === 2026 ? new Date() : new Date('2026-11-05')),
  );
  const [expense, setExpense] = useState(false);
  const [ledgerType, setLedgerType] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'finance', from, to],
    queryFn: () => adminApi.finance({ from, to }),
  });
  const debts = useQuery({
    queryKey: ['admin', 'debts'],
    queryFn: async () => ({
      unpaid: await adminApi.orders.list({ paymentStatus: 'unpaid', pageSize: 100 }),
      receipts: await adminApi.inventory.receipts(),
    }),
    enabled: tab === 'debt',
  });
  const r = q.data;
  const ledger = useMemo(
    () => (r?.ledger ?? []).filter((x) => !ledgerType || x.type === ledgerType),
    [r, ledgerType],
  );

  const exportCsv = () =>
    r &&
    downloadCsv('bao-cao-thu-chi.csv', [
      ['Ngày', 'Mã GD', 'Nội dung', 'Loại', 'Danh mục', 'Số tiền'],
      ...r.ledger.map((x) => [
        formatDate(x.date),
        x.code,
        x.content,
        x.type === 'income' ? 'Thu' : 'Chi',
        x.category,
        x.amount,
      ]),
    ]);
  const income = r?.income;
  const stmt: Array<[string, number, boolean?]> = income
    ? [
        ['Doanh thu bán hàng', income.gross],
        ['Giảm giá / hoàn tiền', -income.discountAndRefund],
        ['Doanh thu thuần', income.net, true],
        ['Giá vốn hàng bán', -income.cogs],
        ['Lợi nhuận gộp', income.grossProfit, true],
        ['Chi phí vận hành', -income.opex],
        ['Lợi nhuận trước thuế', income.profitBeforeTax, true],
      ]
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo thu chi"
        description="Thống kê và phân tích hoạt động kinh doanh."
        actions={
          <>
            <input
              type="date"
              aria-label="Từ ngày"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="field !w-auto"
            />
            <span className="text-muted">–</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="field !w-auto"
            />
            <Button variant="outline" onClick={exportCsv}>
              <Icon name="download" size={16} /> Xuất báo cáo
            </Button>
            <Button onClick={() => setExpense(true)}>
              <Icon name="plus" size={16} /> Thêm phiếu chi
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Tổng quan thu chi' },
          { key: 'revenue', label: 'Doanh thu' },
          { key: 'expense', label: 'Chi phí' },
          { key: 'ledger', label: 'Sổ thu chi' },
          { key: 'debt', label: 'Công nợ' },
        ]}
      />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          {(tab === 'overview' || tab === 'revenue' || tab === 'expense') && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Tổng thu"
                icon="dollar"
                loading={q.isLoading}
                value={formatCurrency(r?.totalIncome ?? 0)}
                delta={r?.deltas.income}
              />
              <KpiCard
                label="Tổng chi"
                icon="wallet"
                loading={q.isLoading}
                value={formatCurrency(r?.totalExpense ?? 0)}
                delta={r?.deltas.expense}
              />
              <KpiCard
                label="Lợi nhuận"
                icon="chart"
                loading={q.isLoading}
                value={formatCurrency(r?.profit ?? 0)}
                delta={r?.deltas.profit}
              />
              <KpiCard
                label="Biên lợi nhuận"
                icon="tag"
                loading={q.isLoading}
                value={`${r?.margin ?? 0}%`}
                delta={r?.deltas.margin}
              />
            </div>
          )}

          {tab === 'overview' && (
            <>
              <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <ChartCard
                  title="Thu – Chi theo tháng (12 tháng) & lợi nhuận"
                  loading={q.isLoading}
                  height={300}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={r?.monthly} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#E8DFD7" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#7A6E66' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => formatCompact(v as number)}
                        tick={{ fontSize: 11, fill: '#7A6E66' }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip formatter={(v, n) => [formatCurrency(v as number), n]} />
                      <Legend />
                      <Bar
                        dataKey="income"
                        name="Thu"
                        fill="#6BAA75"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="expense"
                        name="Chi"
                        fill="#C0605A"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        name="Lợi nhuận"
                        stroke="#8B4A2B"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Cơ cấu chi phí" loading={q.isLoading} height={300}>
                  <DonutChart
                    data={(r?.expenseBreakdown ?? [])
                      .filter((x) => x.amount > 0)
                      .map((x) => ({ name: x.label, value: x.amount }))}
                    centerTop={formatCompact(r?.totalExpense ?? 0)}
                    centerBottom="Tổng chi"
                    formatValue={(d, p) => `${formatCompact(d.value)} · ${p}%`}
                  />
                </ChartCard>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="card p-5">
                  <h2 className="mb-3 font-bold">Doanh thu theo kênh thanh toán</h2>
                  <ul className="space-y-3">
                    {r?.byPaymentMethod.map((m, i) => (
                      <li key={m.method}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{m.method}</span>
                          <span className="font-semibold">
                            {formatCurrency(m.amount)} · {m.percent}%
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${m.percent}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="card p-5">
                  <h2 className="mb-3 font-bold">Báo cáo kết quả kinh doanh</h2>
                  <dl className="space-y-1.5 text-sm">
                    {stmt.map(([label, val, bold]) => (
                      <div
                        key={label}
                        className={`flex justify-between ${bold ? 'border-t border-line pt-1.5 font-bold' : ''}`}
                      >
                        <dt className={bold ? '' : 'text-muted'}>
                          {bold ? '= ' : ''}
                          {label}
                        </dt>
                        <dd className={val < 0 ? 'text-danger' : bold ? 'text-primary' : ''}>
                          {val < 0 ? '−' : ''}
                          {formatCurrency(Math.abs(val))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
              <section className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold">Sổ thu chi gần đây</h2>
                  <button
                    type="button"
                    onClick={() => setTab('ledger')}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Xem tất cả →
                  </button>
                </div>
                <Ledger rows={r?.ledger ?? []} pageSize={8} />
              </section>
            </>
          )}

          {tab === 'revenue' && (
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <ChartCard title="Doanh thu theo ngày (31 ngày gần nhất)" loading={q.isLoading} height={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r?.daily} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E8DFD7" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDay}
                      tick={{ fontSize: 11, fill: '#7A6E66' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCompact(v as number)}
                      tick={{ fontSize: 11, fill: '#7A6E66' }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(v) => [formatCurrency(v as number), 'Doanh thu']}
                      labelFormatter={(l) => fmtDay(String(l))}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#8B4A2B"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Doanh thu theo danh mục" loading={q.isLoading} height={280}>
                <DonutChart
                  data={(r?.byCategory ?? []).map((c) => ({ name: c.name, value: c.amount }))}
                  centerTop={`${formatCompact(r?.byCategory.reduce((s, c) => s + c.amount, 0) ?? 0)}`}
                  centerBottom="Tổng doanh thu"
                />
              </ChartCard>
              <section className="card p-5 xl:col-span-2">
                <h2 className="mb-3 font-bold">Top sản phẩm bán chạy</h2>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">#</th>
                      <th>Sản phẩm</th>
                      <th>Số lượng</th>
                      <th className="text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r?.topProducts.map((p, i) => (
                      <tr key={p.productId}>
                        <td className="py-2.5 font-bold">{i + 1}</td>
                        <td>
                          <Link
                            href={`/admin/products/${p.productId}`}
                            className="flex items-center gap-3 hover:text-primary"
                          >
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                              {p.imageUrl && (
                                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                              )}
                            </span>
                            {p.name}
                          </Link>
                        </td>
                        <td>{p.sold}</td>
                        <td className="text-right font-semibold">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === 'expense' && (
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ChartCard title="Cơ cấu chi phí" loading={q.isLoading} height={260}>
                <DonutChart
                  data={(r?.expenseBreakdown ?? [])
                    .filter((x) => x.amount > 0)
                    .map((x) => ({ name: x.label, value: x.amount }))}
                  centerTop={formatCompact(r?.totalExpense ?? 0)}
                  centerBottom="Tổng chi"
                />
              </ChartCard>
              <section className="card p-5">
                <h2 className="mb-3 font-bold">Chi tiết theo danh mục</h2>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">Danh mục</th>
                      <th className="text-right">Số tiền</th>
                      <th className="text-right">Tỉ trọng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r?.expenseBreakdown.map((x) => (
                      <tr key={x.category}>
                        <td className="py-2.5">{x.label}</td>
                        <td className="text-right font-semibold">{formatCurrency(x.amount)}</td>
                        <td className="text-right">{x.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="card p-5 xl:col-span-2">
                <h2 className="mb-3 font-bold">Phiếu chi gần đây</h2>
                <Ledger
                  rows={(r?.ledger ?? []).filter((x) => x.type === 'expense')}
                  pageSize={10}
                  paginated
                />
              </section>
            </div>
          )}

          {tab === 'ledger' && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Sổ thu chi</h2>
                <select
                  aria-label="Loại giao dịch"
                  className="field !w-auto"
                  value={ledgerType}
                  onChange={(e) => setLedgerType(e.target.value)}
                >
                  <option value="">Thu & chi</option>
                  <option value="income">Chỉ thu</option>
                  <option value="expense">Chỉ chi</option>
                </select>
              </div>
              <Ledger rows={ledger} pageSize={12} paginated />
            </section>
          )}

          {tab === 'debt' && (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="card p-5">
                <h2 className="mb-1 font-bold">Công nợ phải thu</h2>
                <p className="mb-3 text-sm text-muted">
                  Đơn hàng chưa thanh toán (COD đang giao, chờ chuyển khoản…)
                </p>
                {debts.data ? (
                  (() => {
                    const rows = debts.data.unpaid.items.filter(
                      (o) => !['cancelled', 'refunded'].includes(o.status),
                    );
                    return (
                      <>
                        <p className="mb-3 text-2xl font-extrabold text-primary">
                          {formatCurrency(rows.reduce((s, o) => s + o.total, 0))}
                        </p>
                        <ul className="divide-y divide-line text-sm">
                          {rows.slice(0, 8).map((o) => (
                            <li key={o.id} className="flex justify-between py-2">
                              <Link
                                href={`/admin/orders/${o.orderCode}`}
                                className="font-semibold hover:text-primary"
                              >
                                #{o.orderCode}
                              </Link>
                              <span>{formatCurrency(o.total)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  })()
                ) : (
                  <p className="text-sm text-muted">Đang tải…</p>
                )}
              </section>
              <section className="card p-5">
                <h2 className="mb-1 font-bold">Công nợ phải trả</h2>
                <p className="mb-3 text-sm text-muted">Phiếu nhập kho chưa hoàn tất (nhà cung cấp)</p>
                {debts.data ? (
                  (() => {
                    const rows = debts.data.receipts.filter((x) => x.type === 'in' && x.status === 'draft');
                    return rows.length ? (
                      <>
                        <p className="mb-3 text-2xl font-extrabold text-primary">
                          {formatCurrency(rows.reduce((s, x) => s + x.total, 0))}
                        </p>
                        <ul className="divide-y divide-line text-sm">
                          {rows.map((x) => (
                            <li key={x.id} className="flex justify-between py-2">
                              <span>
                                {x.code} · {x.supplierName}
                              </span>
                              <span>{formatCurrency(x.total)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-sm text-muted">Không có công nợ phải trả.</p>
                    );
                  })()
                ) : (
                  <p className="text-sm text-muted">Đang tải…</p>
                )}
              </section>
            </div>
          )}
        </>
      )}
      <ExpenseModal open={expense} onClose={() => setExpense(false)} />
    </div>
  );
}
