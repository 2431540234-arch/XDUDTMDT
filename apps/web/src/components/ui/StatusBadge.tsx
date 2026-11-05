import { cn } from '@/lib/cn';
import { toneClass, type BadgeTone, type StatusInfo } from '@/lib/status';

interface Props {
  info?: StatusInfo;
  label?: string;
  tone?: BadgeTone;
  className?: string;
}

/** Badge trạng thái dùng chung (màu theo WIREFRAME.md mục 0.2) */
export default function StatusBadge({ info, label, tone, className }: Props) {
  const t = info?.tone ?? tone ?? 'gray';
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        toneClass[t],
        className,
      )}
    >
      {info?.label ?? label}
    </span>
  );
}
