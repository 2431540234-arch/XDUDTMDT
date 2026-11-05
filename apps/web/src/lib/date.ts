// Tiện ích ngày tháng nhỏ dùng ở giao diện
import { formatDate } from './format';

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const format = (d: Date) => formatDate(d);

/** yyyy-mm-dd theo giờ địa phương (cho <input type="date">) */
export function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ngày "hôm nay" dùng làm mặc định cho bộ lọc: ngày hệ thống nếu nằm trong năm dữ liệu mẫu (2026), ngược lại 05/11/2026 */
export function dataToday(): Date {
  const now = new Date();
  return now.getFullYear() === 2026 ? now : new Date('2026-11-05T09:00:00');
}

export const shiftDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
