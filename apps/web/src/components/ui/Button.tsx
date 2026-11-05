import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover border border-primary',
  outline: 'border border-primary text-primary bg-white hover:bg-primary-soft',
  ghost: 'border border-transparent text-ink hover:bg-surface-muted',
  soft: 'border border-line bg-surface-muted text-ink hover:bg-line/60',
  danger: 'border border-danger bg-danger text-white hover:opacity-90',
};
const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
};

interface Common {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function buttonClass({ variant = 'primary', size = 'md', block }: Common, extra?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    sizes[size],
    block && 'w-full',
    extra,
  );
}

export default function Button({
  variant,
  size,
  block,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block }, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  block,
  className,
  children,
  href,
  ...rest
}: Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block }, className)} {...rest}>
      {children}
    </Link>
  );
}
