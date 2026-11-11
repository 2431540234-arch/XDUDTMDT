// Cấp mã tăng dần an toàn khi chạy đồng thời: một dòng bộ đếm trong code_counters, tăng bằng UPSERT nguyên tử
// (khóa dòng đến hết transaction nên hai request không bao giờ nhận cùng một số).
import type { Prisma } from '@prisma/client';

export async function nextCounter(tx: Prisma.TransactionClient, key: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
    INSERT INTO code_counters (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = code_counters.value + 1
    RETURNING value`;
  return Number(rows[0].value);
}

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

/** Mã đơn hàng: ALV-YYYYMMDD-NNNN (NNNN tăng theo ngày) */
export async function nextOrderCode(tx: Prisma.TransactionClient, at: Date = new Date()): Promise<string> {
  const ymd = vnDateKey(at);
  return `ALV-${ymd}-${pad(await nextCounter(tx, `ORD:${ymd}`), 4)}`;
}

/** Mã đổi trả RT0001 */
export const nextReturnCode = async (tx: Prisma.TransactionClient) =>
  `RT${pad(await nextCounter(tx, 'RT'), 4)}`;
/** Mã phiếu kho PN0001 (nhập) / PX0001 (xuất) */
export const nextReceiptCode = async (tx: Prisma.TransactionClient, type: 'in' | 'out') => {
  const p = type === 'in' ? 'PN' : 'PX';
  return `${p}${pad(await nextCounter(tx, p), 4)}`;
};
/** Mã phiếu chi CH-0001 */
export const nextExpenseCode = async (tx: Prisma.TransactionClient) =>
  `CH-${pad(await nextCounter(tx, 'CH'), 4)}`;
