'use client';

// Hiệu quả không gian mẫu (UC-ADM-29, phần không gian): phễu lượt xem → bấm hotspot → thêm vào giỏ theo từng không gian và các
// sản phẩm dẫn khách tới không gian. Người dùng và khách được gộp theo visitorId (xem docs/API_CONTRACT.md).
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard, { CHART_COLORS } from '@/components/admin/ChartCard';
import { PageHeader } from '@/components/admin/FilterBar';
import KpiCard from '@/components/admin/KpiCard';
import { toInputDate } from '@/lib/date';
import { errorMessage } from '@/lib/validators';
import { adminApi } from '@/services/admin.api';

const pct = (r: number) => `${(r * 100).toFixed(1).replace('.', ',')}%`;
const short = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

export default function AdminSpaceStatsPage() {
  const today = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(today.getTime() - 29 * 86_400_000)));
  const [to, setTo] = useState(toInputDate(today));
  const q = useQuery({
    queryKey: ['admin', 'space-funnel', from, to],
    queryFn: () => adminApi.spaceFunnel({ from, to }),
    enabled: Boolean(from && to && from <= to),
  });
  const d = q.data;
  const chart = (d?.spaces ?? []).slice(0, 10).map((s) => ({
    name: short(s.title),
    'Người xem': s.viewers,
    'Bấm hotspot': s.clicked,
    'Thêm vào giỏ': s.carted,
  }));

  return (
    <div className="space-y-5" data-testid="space-funnel">
      <PageHeader
        title="Hiệu quả không gian mẫu"
        description="Người xem → bấm điểm tương tác → thêm vào giỏ, theo từng không gian (người dùng và khách gộp theo mã khách)."
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
            <Link href="/admin/reports" className="text-sm font-semibold text-primary hover:underline">
              Báo cáo thu chi
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Người xem"
          value={String(d?.totals.viewers ?? 0)}
          icon="users"
          loading={q.isLoading}
        />
        <KpiCard
          label="Bấm điểm tương tác"
          value={d ? `${d.totals.clicked} (${pct(d.totals.clickRate)})` : '0'}
          icon="tag"
          loading={q.isLoading}
        />
        <KpiCard
          label="Thêm vào giỏ"
          value={d ? `${d.totals.carted} (${pct(d.totals.cartRate)})` : '0'}
          icon="cart"
          loading={q.isLoading}
        />
        <KpiCard
          label="Bấm → thêm giỏ"
          value={d ? pct(d.totals.clickToCartRate) : '0%'}
          icon="chart"
          loading={q.isLoading}
        />
      </div>

      <ChartCard
        title="Phễu theo không gian (10 không gian nhiều người xem nhất)"
        loading={q.isLoading}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        height={320}
      >
        {chart.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Chưa có lượt xem nào trong khoảng này.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Người xem" fill={CHART_COLORS[0]} />
              <Bar dataKey="Bấm hotspot" fill={CHART_COLORS[2]} />
              <Bar dataKey="Thêm vào giỏ" fill={CHART_COLORS[4]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 font-bold">Chi tiết từng không gian</h2>
          <table className="w-full text-sm" data-testid="space-funnel-table">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3">Không gian</th>
                <th className="px-2 text-right">Lượt xem</th>
                <th className="px-2 text-right">Người xem</th>
                <th className="px-2 text-right">Bấm hotspot</th>
                <th className="px-2 text-right">Thêm giỏ</th>
                <th className="px-2 text-right">Bấm → giỏ</th>
              </tr>
            </thead>
            <tbody>
              {(d?.spaces ?? []).map((s) => (
                <tr
                  key={s.spaceId}
                  className="border-b border-line/60"
                  data-testid={`space-row-${s.spaceId}`}
                >
                  <td className="py-2 pr-3">
                    <p className="font-semibold">{s.title}</p>
                    {s.sources.length > 0 && (
                      <p className="text-xs text-muted">
                        Dẫn tới từ: {s.sources.map((x) => `${x.name} (${x.viewers})`).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-2 text-right">{s.views}</td>
                  <td className="px-2 text-right">{s.viewers}</td>
                  <td className="px-2 text-right">
                    {s.clicked} <span className="text-xs text-muted">({pct(s.clickRate)})</span>
                  </td>
                  <td className="px-2 text-right">
                    {s.carted} <span className="text-xs text-muted">({pct(s.cartRate)})</span>
                  </td>
                  <td className="px-2 text-right">{pct(s.clickToCartRate)}</td>
                </tr>
              ))}
              {d && d.spaces.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    Chưa có lượt xem nào trong khoảng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Sản phẩm dẫn khách tới không gian</h2>
          {d && d.sources.length === 0 && (
            <p className="text-sm text-muted">Chưa có lượt nào đi từ trang sản phẩm.</p>
          )}
          <ol className="space-y-2" data-testid="space-sources">
            {(d?.sources ?? []).map((p) => (
              <li key={p.productId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  {p.slug ? (
                    <Link
                      href={`/products/${p.slug}`}
                      className="line-clamp-1 font-semibold hover:text-primary"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{p.name}</span>
                  )}
                  <span className="text-xs text-muted">{p.spaces} không gian</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-bold">{p.viewers}</span>{' '}
                  <span className="text-xs text-muted">người · {p.views} lượt</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
