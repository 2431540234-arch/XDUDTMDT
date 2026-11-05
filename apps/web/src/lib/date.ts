// Tiện ích ngày tháng nhỏ dùng ở giao diện
import { formatDate } from './format';

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const format = (d: Date) => formatDate(d);

/** yyyy-mm-dd theo giờ địa phương (cho <input type="date">) */
export function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
