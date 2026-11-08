import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { refreshAfterWrite } from '@/lib/query-refresh';

/** Giả lập danh sách: server đọc dữ liệu NGAY khi nhận request, trả về sau 50 ms (như GET /admin/media lúc đang có PATCH) */
function serverList() {
  let alt = 'cũ';
  let calls = 0;
  const fetchList = () => {
    calls++;
    const snapshot = alt;
    return new Promise<string>((r) => setTimeout(() => r(snapshot), 50));
  };
  return { fetchList, write: () => (alt = 'mới'), calls: () => calls };
}

async function run(refresh: (qc: QueryClient, key: string[]) => Promise<void>) {
  const qc = new QueryClient();
  const s = serverList();
  const key = ['admin', 'media', 'ban an e2e'];
  // observer đang mount (query active) và lần tải đầu của khóa mới đang bay, đã đọc 'cũ'
  const obs = new QueryObserver(qc, { queryKey: key, queryFn: s.fetchList });
  const unsub = obs.subscribe(() => undefined);
  await new Promise((r) => setTimeout(r, 10));
  s.write(); // PATCH hoàn tất trong lúc GET đang bay
  await refresh(qc, ['admin', 'media']);
  await new Promise((r) => setTimeout(r, 120));
  unsub();
  return { data: qc.getQueryData<string>(key), calls: s.calls() };
}

describe('refreshAfterWrite', () => {
  it('invalidateQueries trơn: lần tải đầu đang bay bị gộp, dữ liệu cũ ở lại (lỗi admin-m5)', async () => {
    const r = await run(async (qc, k) => {
      await qc.invalidateQueries({ queryKey: k });
    });
    expect(r.calls).toBe(1);
    expect(r.data).toBe('cũ');
  });

  it('refreshAfterWrite: hủy rồi làm mới ⇒ có lần tải mới sau khi ghi, dữ liệu mới', async () => {
    const r = await run((qc, k) => refreshAfterWrite(qc, k));
    expect(r.calls).toBe(2);
    expect(r.data).toBe('mới');
  });
});
