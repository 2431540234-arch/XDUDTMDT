import Link from 'next/link';
import Icon from './Icon';

export interface Crumb {
  label: string;
  href?: string;
}

/** Trang chủ > Sản phẩm > Sofa > Sofa Nordic — mục cuối đậm, màu primary */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            {c.href && !last ? (
              <Link href={c.href} className="hover:text-primary">
                {c.label}
              </Link>
            ) : (
              <span
                className={last ? 'font-semibold text-primary' : undefined}
                aria-current={last ? 'page' : undefined}
              >
                {c.label}
              </span>
            )}
            {!last && <Icon name="chevronRight" size={14} />}
          </span>
        );
      })}
    </nav>
  );
}
