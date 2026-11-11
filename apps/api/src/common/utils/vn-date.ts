// Ngày theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7, không có giờ mùa hè). MỌI chỗ cần "ngày" của nghiệp vụ (thống kê theo ngày,
// ghi cột DATE, lọc theo ngày, hạn dùng) phải dùng các hàm này, không dùng toISOString().slice(0, 10) hay new Date() trực tiếp:
// trong khung 00:00–07:00 giờ Việt Nam ngày UTC vẫn là hôm qua nên sẽ sai một ngày.
export const VN_TZ = 'Asia/Ho_Chi_Minh';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày YYYY-MM-DD theo giờ Việt Nam của một thời điểm (mặc định bây giờ) */
export const vnYmd = (d: Date = new Date()): string => d.toLocaleDateString('sv-SE', { timeZone: VN_TZ });

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (không phụ thuộc múi giờ máy) */
export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 00:00:00.000 giờ Việt Nam của ngày `ymd` */
export const startOfDayVn = (ymd: string): Date => new Date(`${ymd}T00:00:00+07:00`);
/** 23:59:59.999 giờ Việt Nam của ngày `ymd` */
export const endOfDayVn = (ymd: string): Date => new Date(`${ymd}T23:59:59.999+07:00`);

/** Giá trị ghi vào cột DATE (Prisma lấy phần ngày UTC): ngày giờ Việt Nam của `d`, 00:00 UTC */
export const vnDbDate = (d: Date = new Date()): Date => new Date(`${vnYmd(d)}T00:00:00Z`);

/**
 * Chuỗi ngày/giờ do người dùng gửi ⇒ Date. Chỉ có ngày (YYYY-MM-DD) thì hiểu là ngày giờ Việt Nam: đầu ngày cho mốc bắt đầu,
 * cuối ngày cho mốc kết thúc; có cả giờ (ISO) thì giữ nguyên. Không hợp lệ ⇒ Invalid Date.
 */
export function parseVnDate(raw: string, edge: 'start' | 'end'): Date {
  if (DATE_ONLY.test(raw)) return edge === 'end' ? endOfDayVn(raw) : startOfDayVn(raw);
  return new Date(raw);
}
