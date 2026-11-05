// Các hàm định dạng dữ liệu (tiền tệ, ngày tháng...)

const thousands = (n: number) =>
  Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 8500000 → "8.500.000đ" */
export function formatCurrency(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  return `${n < 0 ? '-' : ''}${thousands(n)}đ`;
}

/** Số rút gọn cho biểu đồ: 235400000 → "235,4M" */
export function formatCompact(value: number): string {
  const a = Math.abs(value);
  if (a >= 1e9) return `${(value / 1e9).toFixed(1).replace('.', ',')}B`;
  if (a >= 1e6) return `${(value / 1e6).toFixed(1).replace('.', ',')}M`;
  if (a >= 1e3) return `${Math.round(value / 1e3)}K`;
  return String(value);
}

export function formatNumber(value: number): string {
  return `${value < 0 ? '-' : ''}${thousands(value)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO → "dd/MM/yyyy" (theo giờ máy) */
export function formatDate(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
}

/** ISO → "dd/MM/yyyy HH:mm" */
export function formatDateTime(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  return d ? `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}

/** "5 phút trước", "2 giờ trước", "3 ngày trước"; quá 30 ngày thì hiện ngày */
export function formatRelativeTime(iso: string | Date, now: Date = new Date()): string {
  const d = toDate(iso);
  if (!d) return '—';
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 45) return 'Vừa xong';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${Math.max(min, 1)} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ngày trước`;
  return formatDate(d);
}

/** Ẩn bớt email: nguyenvana@gmail.com → ng***a@gmail.com */
export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  if (name.length <= 3) return `${name[0] ?? ''}***@${domain}`;
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

/** % giảm từ giá bán và giá gốc */
export function discountPercent(price: number, original: number | null | undefined): number {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

/** Tên viết tắt cho avatar: "Nguyễn Văn A" → "NA" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Sofa Nordic" → "sofa-nordic" (bỏ dấu tiếng Việt) */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
