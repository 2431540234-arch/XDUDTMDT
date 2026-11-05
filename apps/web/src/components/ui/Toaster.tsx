'use client';

import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';
import Icon from './Icon';

export default function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-btn border bg-white px-4 py-3 text-sm shadow-lg',
            t.type === 'success' && 'border-emerald-300',
            t.type === 'error' && 'border-rose-300',
            t.type === 'info' && 'border-line',
          )}
        >
          <Icon
            name={t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'info'}
            size={18}
            className={cn(
              t.type === 'success' && 'text-emerald-600',
              t.type === 'error' && 'text-danger',
              t.type === 'info' && 'text-primary',
            )}
          />
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Đóng thông báo"
            className="text-muted hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
