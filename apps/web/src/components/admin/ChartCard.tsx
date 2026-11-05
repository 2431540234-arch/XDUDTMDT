'use client';

import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ErrorState } from '@/components/ui/States';
import { cn } from '@/lib/cn';

/** Bảng màu biểu đồ (nâu – be – xanh – tím) dùng thống nhất */
export const CHART_COLORS = ['#8B4A2B', '#D8A47F', '#5B8DB8', '#7B6CB5', '#6BAA75', '#E5B93C', '#C0605A'];

interface Props {
  title: string;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  height?: number;
  children: ReactNode;
}

/** Khung biểu đồ: tiêu đề + dropdown hành động + trạng thái tải/lỗi */
export default function ChartCard({
  title,
  action,
  loading,
  error,
  onRetry,
  className,
  height = 260,
  children,
}: Props) {
  return (
    <section className={cn('card p-5', className)}>
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        {action}
      </header>
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="skeleton w-full" style={{ height }} aria-busy />
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </section>
  );
}

export interface DonutDatum {
  name: string;
  value: number;
}

/** Donut + chú giải bên phải; centerLabel hiển thị ở tâm */
export function DonutChart({
  data,
  centerTop,
  centerBottom,
  formatValue,
}: {
  data: DonutDatum[];
  centerTop?: string;
  centerBottom?: string;
  formatValue?: (d: DonutDatum, percent: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full min-w-[150px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centerTop || centerBottom) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-extrabold">{centerTop}</span>
            <span className="text-xs text-muted">{centerBottom}</span>
          </div>
        )}
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={d.name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-muted">{d.name}</span>
              <span className="ml-auto pl-3 font-semibold">
                {formatValue ? formatValue(d, pct) : `${pct}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
