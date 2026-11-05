'use client';

// Bộ lọc sidebar (WIREFRAME 1.5): Danh mục, Khoảng giá, Màu sắc, Chất liệu, Phong cách; mỗi nhóm thu gọn/mở rộng.
// Trên mobile hiển thị dạng drawer (điều khiển qua uiStore.filterDrawerOpen).
import { useState } from 'react';
import ColorSwatch from '@/components/ui/ColorSwatch';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';
import type { ProductFacets } from '@/types/api';

export interface FilterValue {
  category: string[];
  price: string[]; // khóa trong PRICE_RANGES
  color: string[];
  material: string[];
  style: string[];
}

export const emptyFilter: FilterValue = { category: [], price: [], color: [], material: [], style: [] };

export const PRICE_RANGES: Array<{ key: string; label: string; min?: number; max?: number }> = [
  { key: 'lt5', label: 'Dưới 5 triệu', max: 5_000_000 },
  { key: '5-10', label: '5 – 10 triệu', min: 5_000_000, max: 10_000_000 },
  { key: '10-20', label: '10 – 20 triệu', min: 10_000_000, max: 20_000_000 },
  { key: 'gt20', label: 'Trên 20 triệu', min: 20_000_000 },
];

/** Gộp các khoảng giá đã chọn thành minPrice/maxPrice (lấy biên ngoài cùng) */
export function priceBounds(keys: string[]): { minPrice?: number; maxPrice?: number } {
  const sel = PRICE_RANGES.filter((r) => keys.includes(r.key));
  if (!sel.length) return {};
  const mins = sel.map((r) => r.min ?? 0);
  const maxs = sel.map((r) => r.max ?? Infinity);
  const max = Math.max(...maxs);
  return { minPrice: Math.min(...mins) || undefined, maxPrice: Number.isFinite(max) ? max : undefined };
}

function Group({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-wide"
      >
        {title}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
  swatch,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
  swatch?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-primary" />
      {swatch && <ColorSwatch hex={swatch} />}
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </label>
  );
}

function Limited<T>({
  items,
  render,
  limit = 6,
}: {
  items: T[];
  render: (i: T) => React.ReactNode;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <>
      {shown.map(render)}
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          {all ? 'Thu gọn' : 'Xem thêm'} <Icon name={all ? 'chevronUp' : 'chevronDown'} size={14} />
        </button>
      )}
    </>
  );
}

interface Props {
  facets?: ProductFacets;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  /** Ẩn nhóm danh mục (trang danh sách theo 1 danh mục) */
  hideCategory?: boolean;
}

function Panel({ facets, value, onChange, hideCategory }: Props) {
  const toggle = (k: keyof FilterValue, v: string) => {
    const cur = value[k];
    onChange({ ...value, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const active = Object.values(value).some((a) => a.length);
  return (
    <div>
      {active && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter)}
          className="mb-1 text-sm font-medium text-primary hover:underline"
        >
          Xóa tất cả bộ lọc
        </button>
      )}
      {!hideCategory && (
        <Group title="Danh mục">
          <Limited
            items={facets?.categories ?? []}
            render={(c) => (
              <CheckRow
                key={c.slug}
                label={c.name}
                count={c.count}
                checked={value.category.includes(c.slug)}
                onChange={() => toggle('category', c.slug)}
              />
            )}
          />
        </Group>
      )}
      <Group title="Khoảng giá">
        {PRICE_RANGES.map((r) => (
          <CheckRow
            key={r.key}
            label={r.label}
            checked={value.price.includes(r.key)}
            onChange={() => toggle('price', r.key)}
          />
        ))}
      </Group>
      <Group title="Màu sắc">
        <Limited
          items={facets?.colors ?? []}
          limit={7}
          render={(c) => (
            <CheckRow
              key={c.hex}
              label={c.name}
              count={c.count}
              swatch={c.hex}
              checked={value.color.includes(c.name)}
              onChange={() => toggle('color', c.name)}
            />
          )}
        />
      </Group>
      <Group title="Chất liệu">
        {(facets?.materials ?? []).map((m) => (
          <CheckRow
            key={m.value}
            label={m.value}
            count={m.count}
            checked={value.material.includes(m.value)}
            onChange={() => toggle('material', m.value)}
          />
        ))}
      </Group>
      <Group title="Phong cách">
        {(facets?.styles ?? []).map((s) => (
          <CheckRow
            key={s.value}
            label={s.value}
            count={s.count}
            checked={value.style.includes(s.value)}
            onChange={() => toggle('style', s.value)}
          />
        ))}
      </Group>
    </div>
  );
}

export default function FilterSidebar(props: Props) {
  const open = useUIStore((s) => s.filterDrawerOpen);
  const setOpen = useUIStore((s) => s.setFilterDrawerOpen);
  return (
    <>
      <aside className="hidden w-[250px] shrink-0 lg:block" aria-label="Bộ lọc sản phẩm">
        <div className="card p-5">
          <Panel {...props} />
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Bộ lọc sản phẩm"
        >
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-white p-5 shadow-2xl',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold">Bộ lọc</h2>
              <button type="button" aria-label="Đóng bộ lọc" onClick={() => setOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <Panel {...props} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-btn bg-primary py-2.5 text-sm font-semibold text-white"
            >
              Xem kết quả
            </button>
          </div>
        </div>
      )}
    </>
  );
}
