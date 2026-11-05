import Link from 'next/link';
import { cn } from '@/lib/cn';

export default function Logo({
  className,
  sub = true,
  href = '/',
}: {
  className?: string;
  sub?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5', className)}
      aria-label="Aurelia Living – Trang chủ"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-lg font-extrabold text-white">
        A
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-wide text-ink">AURELIA LIVING</span>
        {sub && (
          <span className="hidden text-[10px] text-muted sm:block">
            Nội thất cho không gian sống hiện đại
          </span>
        )}
      </span>
    </Link>
  );
}
