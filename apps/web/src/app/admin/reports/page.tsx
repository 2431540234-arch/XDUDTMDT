'use client';

// Báo cáo doanh thu (WIREFRAME 7.28): tổng quan, doanh thu theo ngày/danh mục, sổ thu
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
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
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { toInputDate } from '@/lib/date';
import { downloadCsv } from '@/lib/csv';
import { formatCompact, formatCurrency, formatDate } from '@/lib/format';
import { adminApi } from '@/services/admin.api';
import type { FinanceReport } from '@/types/api';

type Tab = 'overview' | 'revenue' | 'ledger';
const fmtDay = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

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
                  <StatusBadge label="Thu" tone="green" />
                </td>
                <td>{r.category}</td>
                <td className="text-right font-semibold text-emerald-600">+{formatCurrency(r.amount)}</td>
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
  const q = useQuery({
    queryKey: ['admin', 'finance', from, to],
    queryFn: () => adminApi.finance({ from, to }),
  });
  const r = q.data;

  const exportCsv = () =>
    r &&
    downloadCsv('bao-cao-doanh-thu.csv', [
      ['Ngày', 'Mã GD', 'Nội dung', 'Loại', 'Danh mục', 'Số tiền'],
      ...r.ledger.map((x) => [formatDate(x.date), x.code, x.content, 'Thu', x.category, x.amount]),
    ]);
  const income = r?.income;
  const stmt: Array<[string, number, boolean?]> = income
    ? [
        ['Doanh thu bán hàng', income.gross],
        ['Giảm giá', -income.discount],
        ['Doanh thu thuần', income.net, true],
      ]
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo doanh thu"
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
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Tổng quan' },
          { key: 'revenue', label: 'Doanh thu' },
          { key: 'ledger', label: 'Sổ thu' },
        ]}
      />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          {(tab === 'overview' || tab === 'revenue') && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Tổng thu"
                icon="dollar"
                loading={q.isLoading}
                value={formatCurrency(r?.totalIncome ?? 0)}
                delta={r?.deltas.income}
              />
            </div>
          )}

          {tab === 'overview' && (
            <>
              <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <ChartCard title="Doanh thu theo tháng (12 tháng)" loading={q.isLoading} height={300}>
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
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
                <section className="card p-5">
                  <h2 className="mb-3 font-bold">Báo cáo doanh thu</h2>
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
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold">Sổ thu gần đây</h2>
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

          {tab === 'ledger' && (
            <section className="card p-5">
              <Ledger rows={r?.ledger ?? []} pageSize={12} paginated />
            </section>
          )}
        </>
      )}
    </div>
  );
}
