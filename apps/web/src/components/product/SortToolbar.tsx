'use client';

import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';

export const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Mới nhất' },
  { value: 'relevance', label: 'Liên quan nhất' },
  { value: 'price:asc', label: 'Giá tăng dần' },
  { value: 'price:desc', label: 'Giá giảm dần' },
  { value: 'soldCount:desc', label: 'Bán chạy' },
  { value: 'ratingAvg:desc', label: 'Đánh giá cao' },
];

interface Props {
  total: number;
  unit?: string;
  sort: string;
  onSort: (v: string) => void;
  layout: 'grid' | 'list';
  onLayout: (l: 'grid' | 'list') => void;
  options?: Array<{ value: string; label: string }>;
  showFilterButton?: boolean;
}

/** Thanh công cụ danh sách (WIREFRAME 1.6): "24 sản phẩm" | Sắp xếp | Grid/List */
export default function SortToolbar({
  total,
  unit = 'sản phẩm',
  sort,
  onSort,
  layout,
  onLayout,
  options = SORT_OPTIONS,
  showFilterButton,
}: Props) {
  const setDrawer = useUIStore((s) => s.setFilterDrawerOpen);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {showFilterButton && (
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex items-center gap-1.5 rounded-btn border border-line bg-white px-3 py-2 text-sm font-medium lg:hidden"
          >
            <Icon name="filter" size={16} /> Bộ lọc
          </button>
        )}
        <p className="text-sm font-semibold">
          {total} {unit}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="hidden sm:inline">Sắp xếp:</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            className="field !w-auto py-2"
            aria-label="Sắp xếp"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div
          className="flex overflow-hidden rounded-btn border border-line bg-white"
          role="group"
          aria-label="Kiểu hiển thị"
        >
          {(['grid', 'list'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLayout(l)}
              aria-pressed={layout === l}
              aria-label={l === 'grid' ? 'Dạng lưới' : 'Dạng danh sách'}
              className={cn(
                'p-2',
                layout === l ? 'bg-primary text-white' : 'text-muted hover:bg-surface-muted',
              )}
            >
              <Icon name={l === 'grid' ? 'grid' : 'list'} size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
