'use client';

// Bảng dữ liệu admin (WIREFRAME 3.0): checkbox đầu dòng, sắp xếp cột, cột thao tác ⋯, footer "Hiển thị a – b trong tổng N", phân trang.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** khóa sort gửi lên API, ví dụ 'createdAt' */
  sortKey?: string;
  className?: string;
}

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  danger?: boolean;
  hidden?: (row: T) => boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectable?: boolean;
  selected?: Array<string | number>;
  onSelect?: (keys: Array<string | number>) => void;
  actions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  activeRowKey?: string | number | null;
  sort?: string;
  onSort?: (sort: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (page: number) => void;
  unit?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

function ActionMenu<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const visible = actions.filter((a) => !a.hidden?.(row));
  if (!visible.length) return null;
  return (
    <div className="relative inline-block" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Thao tác"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-ink"
      >
        <Icon name="dots" />
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-btn border border-line bg-white py-1 text-left shadow-xl">
          {visible.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  a.onClick(row);
                }}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted',
                  a.danger && 'text-danger',
                )}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  selectable,
  selected = [],
  onSelect,
  actions,
  onRowClick,
  activeRowKey,
  sort,
  onSort,
  page = 1,
  pageSize = 10,
  total,
  onPage,
  unit = 'mục',
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription = 'Không tìm thấy bản ghi nào phù hợp với bộ lọc.',
}: Props<T>) {
  const [field, dir] = (sort ?? '').split(':');
  const allKeys = (rows ?? []).map(rowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.includes(k));
  const colCount = columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);
  const totalCount = total ?? rows?.length ?? 0;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    className="h-4 w-4 accent-primary"
                    checked={allSelected}
                    onChange={() => onSelect?.(allSelected ? [] : allKeys)}
                  />
                </th>
              )}
              {columns.map((c) => {
                const sortable = Boolean(c.sortKey && onSort);
                const active = sortable && field === c.sortKey;
                return (
                  <th
                    key={c.key}
                    className={cn('px-4 py-3', c.className)}
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(`${c.sortKey}:${active && dir === 'asc' ? 'desc' : 'asc'}`)}
                        className="inline-flex items-center gap-1 uppercase hover:text-ink"
                      >
                        {c.header}
                        <Icon
                          name={active ? (dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronDown'}
                          size={12}
                          className={active ? 'text-primary' : 'opacity-40'}
                        />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {actions && <th className="w-12 px-4 py-3 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && !rows?.length && null}
            {rows?.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'hover:bg-surface-muted/40',
                    onRowClick && 'cursor-pointer',
                    activeRowKey === key && 'bg-primary-soft/60',
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Chọn dòng"
                        className="h-4 w-4 accent-primary"
                        checked={selected.includes(key)}
                        onChange={() =>
                          onSelect?.(
                            selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key],
                          )
                        }
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">
                      <ActionMenu row={row} actions={actions} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && !rows?.length && <TableSkeleton cols={Math.min(colCount, 6)} />}
      {error && !loading && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && rows?.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
      {(totalCount > 0 || onPage) && !error && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted sm:flex-row">
          <span>
            Hiển thị {from} – {to} trong tổng {totalCount} {unit}
          </span>
          {onPage && (
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
              onChange={onPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
