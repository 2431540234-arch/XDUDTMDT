'use client';

// Tổng quan – Dashboard quản trị (WIREFRAME 3.1)
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard, { DonutChart } from '@/components/admin/ChartCard';
import { PageHeader } from '@/components/admin/FilterBar';
import KpiCard from '@/components/admin/KpiCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { dataToday, shiftDays, toInputDate } from '@/lib/date';
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  initials,
} from '@/lib/format';
import { orderStatusInfo } from '@/lib/status';
import { adminApi } from '@/services/admin.api';

const PRESETS = [
  { days: 7, label: '7 ngày qua' },
  { days: 14, label: '14 ngày qua' },
  { days: 30, label: '30 ngày qua' },
  { days: 90, label: '90 ngày qua' },
];

const fmtDay = (d: string) =>
  d.length === 7 ? `${d.slice(5)}/${d.slice(0, 4)}` : `${d.slice(8)}/${d.slice(5, 7)}`;

export default function DashboardPage() {
  const today = dataToday();
  const [from, setFrom] = useState(toInputDate(shiftDays(today, -34)));
  const [to, setTo] = useState(toInputDate(today));
  const [chartDays, setChartDays] = useState(7);
  const stats = useQuery({
    queryKey: ['admin', 'stats', from, to],
    queryFn: () => adminApi.stats({ from, to }),
  });
  const chart = useQuery({
    queryKey: ['admin', 'stats-chart', chartDays, to],
    queryFn: () =>
      adminApi.stats({ from: toInputDate(shiftDays(new Date(`${to}T12:00:00`), -(chartDays - 1))), to }),
  });
  const s = stats.data;
  const spark = (key: 'revenue' | 'orders') => chart.data?.revenueSeries.map((x) => x[key]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tổng quan"
        description="Chào mừng bạn trở lại, hôm nay hệ thống hoạt động ổn định."
        actions={
          <div className="flex items-center gap-2">
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
          </div>
        }
      />
      {stats.isError ? (
        <ErrorState onRetry={() => stats.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Tổng đơn hàng"
              icon="receipt"
              loading={stats.isLoading}
              value={formatNumber(s?.totalOrders ?? 0)}
              delta={s?.deltas.orders}
              spark={spark('orders')}
            />
            <KpiCard
              label="Doanh thu"
              icon="dollar"
              loading={stats.isLoading}
              value={formatCurrency(s?.revenue ?? 0)}
              delta={s?.deltas.revenue}
              spark={spark('revenue')}
            />
            <KpiCard
              label="Khách hàng mới"
              icon="users"
              loading={stats.isLoading}
              value={formatNumber(s?.newCustomers ?? 0)}
              delta={s?.deltas.customers}
            />
            <KpiCard
              label="Sản phẩm"
              icon="box"
              loading={stats.isLoading}
              value={formatNumber(s?.totalProducts ?? 0)}
              delta={s?.deltas.products}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <ChartCard
              title="Doanh thu"
              loading={chart.isLoading}
              error={chart.isError ? 'Không tải được biểu đồ.' : null}
              onRetry={() => chart.refetch()}
              action={
                <select
                  aria-label="Khoảng thời gian"
                  value={chartDays}
                  onChange={(e) => setChartDays(Number(e.target.value))}
                  className="field !w-auto py-1.5 text-xs"
                >
                  {PRESETS.map((p) => (
                    <option key={p.days} value={p.days}>
                      {p.label}
                    </option>
                  ))}
                </select>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chart.data?.revenueSeries}
                  margin={{ top: 5, right: 16, left: 0, bottom: 0 }}
                >
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
                    dot={{ r: 3, fill: '#8B4A2B' }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Tỷ lệ đơn hàng theo trạng thái" loading={stats.isLoading}>
              <DonutChart
                data={(s?.statusBreakdown ?? [])
                  .filter((x) => x.count > 0)
                  .map((x) => ({ name: orderStatusInfo[x.status].label, value: x.count }))}
                centerTop={String(s?.totalOrders ?? 0)}
                centerBottom="Tổng đơn"
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Hoạt động gần đây</h2>
                <Link href="/admin/orders" className="text-sm font-semibold text-primary hover:underline">
                  Xem tất cả →
                </Link>
              </div>
              {stats.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ul className="space-y-3">
                  {s?.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 text-sm">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                        {initials(a.actorName)}
                      </span>
                      <p className="min-w-0 flex-1">
                        <b>{a.actorName}</b> – {a.text}
                      </p>
                      <span className="shrink-0 text-xs text-muted">{formatRelativeTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Đơn hàng gần đây</h2>
                <Link href="/admin/orders" className="text-sm font-semibold text-primary hover:underline">
                  Xem tất cả →
                </Link>
              </div>
              {stats.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs uppercase text-muted">
                      <tr>
                        <th className="py-2">Mã đơn</th>
                        <th>Khách hàng</th>
                        <th>Tổng tiền</th>
                        <th>Trạng thái</th>
                        <th>Ngày đặt</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {s?.recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="py-2.5 font-semibold">#{o.orderCode}</td>
                          <td>
                            <span className="flex items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                                {initials(o.customer?.fullName ?? '?')}
                              </span>
                              {o.customer?.fullName}
                            </span>
                          </td>
                          <td className="font-semibold">{formatCurrency(o.total)}</td>
                          <td>
                            <StatusBadge info={orderStatusInfo[o.status]} />
                          </td>
                          <td>{formatDate(o.createdAt)}</td>
                          <td className="text-right">
                            <Link
                              href={`/admin/orders/${o.orderCode}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              Xem
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Sản phẩm bán chạy</h2>
              <Link href="/admin/reports" className="text-sm font-semibold text-primary hover:underline">
                Xem báo cáo →
              </Link>
            </div>
            {stats.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : s?.topProducts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">Sản phẩm</th>
                      <th>Đã bán</th>
                      <th>Doanh thu</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.topProducts.map((p) => (
                      <tr key={p.productId}>
                        <td className="py-2.5">
                          <span className="flex items-center gap-3">
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                              {p.imageUrl && (
                                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                              )}
                            </span>
                            {p.name}
                          </span>
                        </td>
                        <td>{p.sold}</td>
                        <td className="font-semibold">{formatCurrency(p.revenue)}</td>
                        <td className="text-right">
                          <Link
                            href={`/admin/products/${p.productId}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            Xem
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">
                Chưa có dữ liệu bán hàng trong khoảng thời gian này.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
