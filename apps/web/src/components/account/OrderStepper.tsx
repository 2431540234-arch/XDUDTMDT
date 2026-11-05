import type { OrderStatus } from '@aurelia-living/shared-types';
import Icon, { type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { ORDER_FLOW, orderStepLabels } from '@/lib/status';

const icons: IconName[] = ['receipt', 'check', 'box', 'truck', 'home'];

interface Props {
  status: OrderStatus;
  /** Thời điểm đạt từng trạng thái (từ order_status_history) */
  times?: Partial<Record<OrderStatus, string>>;
}

/** Stepper 5 bước (WIREFRAME 7.1/7.18): bước xong nền primary, bước hiện tại viền primary */
export default function OrderStepper({ status, times = {} }: Props) {
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <div className="rounded-btn border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {status === 'cancelled' ? 'Đơn hàng đã bị hủy' : 'Đơn hàng đã được hoàn tiền'}
        {times[status] ? ` lúc ${formatDateTime(times[status])}` : ''}.
      </div>
    );
  }
  const idx = ORDER_FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Tiến trình đơn hàng">
      {ORDER_FLOW.map((s, i) => {
        const done = i < idx || (i === idx && status === 'completed');
        const current = i === idx && !done;
        return (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-5 -z-0 h-0.5 w-full',
                  i <= idx ? 'bg-primary' : 'bg-line',
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2',
                done
                  ? 'border-primary bg-primary text-white'
                  : current
                    ? 'border-primary bg-white text-primary'
                    : 'border-line bg-white text-muted',
              )}
            >
              <Icon name={done ? 'check' : icons[i]} size={18} />
            </span>
            <span
              className={cn('mt-2 text-xs font-semibold sm:text-sm', i <= idx ? 'text-ink' : 'text-muted')}
            >
              {orderStepLabels[i]}
            </span>
            {times[s] && <span className="text-[11px] text-muted">{formatDateTime(times[s])}</span>}
          </li>
        );
      })}
    </ol>
  );
}
