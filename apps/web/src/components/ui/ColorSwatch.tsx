import { cn } from '@/lib/cn';

interface Props {
  hex: string;
  name?: string;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Chấm tròn màu; có onClick thì là nút chọn màu (viền primary khi đang chọn) */
export default function ColorSwatch({ hex, name, size = 14, selected, onClick, className }: Props) {
  const style = { width: size, height: size, backgroundColor: hex };
  const base = cn(
    'inline-block rounded-full border border-black/15',
    selected && 'ring-2 ring-primary ring-offset-2',
    className,
  );
  if (!onClick) return <span title={name} style={style} className={base} />;
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={selected}
      onClick={onClick}
      style={style}
      className={cn(base, 'transition hover:scale-110')}
    />
  );
}
