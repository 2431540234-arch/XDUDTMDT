// Cấp mã đơn hàng an toàn khi chạy đồng thời: dùng SEQUENCE `order_code_seq` của PostgreSQL (nextval nguyên tử,
// hai request không bao giờ nhận cùng một số). Số tăng liên tục, không reset theo ngày; rollback có thể làm nhảy số.
import type { Prisma } from '@prisma/client';

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** Ngày theo múi giờ Asia/Ho_Chi_Minh dạng YYYYMMDD */
export function vnDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts.replace(/-/g, '');
}

/** Mã đơn hàng: ALV-YYYYMMDD-NNNNNN (NNNNNN lấy từ order_code_seq, tăng liên tục) */
export async function nextOrderCode(tx: Prisma.TransactionClient, at: Date = new Date()): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('order_code_seq') AS value`;
  return `ALV-${vnDateKey(at)}-${pad(Number(rows[0].value), 6)}`;
}
