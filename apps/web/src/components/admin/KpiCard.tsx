import Icon, { type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

interface Props {
  label: string;
  value: string;
  /** % tăng/giảm so với kỳ trước (âm = giảm) */
  delta?: number;
  icon: IconName;
  /** Dữ liệu sparkline (tùy chọn) */
  spark?: number[];
  loading?: boolean;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-24" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? '#2e7d32' : '#e53935'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Thẻ KPI: icon + số + % tăng/giảm + sparkline */
export default function KpiCard({ label, value, delta, icon, spark, loading }: Props) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        {loading ? (
          <div className="skeleton mt-1 h-7 w-28" />
        ) : (
          <p className="truncate text-2xl font-extrabold">{value}</p>
        )}
        {delta !== undefined && !loading && (
          <p
            className={cn(
              'flex items-center gap-1 text-xs font-semibold',
              up ? 'text-emerald-600' : 'text-danger',
            )}
          >
            <Icon name={up ? 'chevronUp' : 'chevronDown'} size={12} />
            {Math.abs(delta)}% <span className="font-normal text-muted">so với kỳ trước</span>
          </p>
        )}
      </div>
      {spark && !loading && <Sparkline data={spark} up={up} />}
    </div>
  );
}
