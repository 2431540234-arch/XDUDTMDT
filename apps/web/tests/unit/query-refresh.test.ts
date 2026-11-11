import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { makeWriteSafe, refreshAfterWrite } from '@/lib/query-refresh';

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

describe('makeWriteSafe (QueryClient dùng chung của ứng dụng)', () => {
  const key = ['admin', 'customers', 'abc'];

  async function invalidateScenario(qc: QueryClient) {
    const s = serverList();
    const obs = new QueryObserver(qc, { queryKey: key, queryFn: s.fetchList });
    const unsub = obs.subscribe(() => undefined);
    await new Promise((r) => setTimeout(r, 10));
    s.write();
    await qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    await new Promise((r) => setTimeout(r, 120));
    unsub();
    return qc.getQueryData<string>(key);
  }

  it('client thường: invalidateQueries để lại dữ liệu cũ; client write-safe: dữ liệu mới', async () => {
    expect(await invalidateScenario(new QueryClient())).toBe('cũ');
    expect(await invalidateScenario(makeWriteSafe(new QueryClient()))).toBe('mới');
  });

  async function setDataScenario(qc: QueryClient) {
    const s = serverList(); // lần tải đang bay sẽ trả 'cũ'
    const obs = new QueryObserver(qc, { queryKey: key, queryFn: s.fetchList });
    const unsub = obs.subscribe(() => undefined);
    await new Promise((r) => setTimeout(r, 10));
    qc.setQueryData(key, 'kết quả máy chủ sau khi ghi'); // vd. setQueryData(cart, giỏ hàng vừa trả về)
    await new Promise((r) => setTimeout(r, 120));
    unsub();
    return qc.getQueryData<string>(key);
  }

  it('client thường: lần tải cũ trả về sau ghi đè mất setQueryData; client write-safe: giữ dữ liệu mới', async () => {
    expect(await setDataScenario(new QueryClient())).toBe('cũ');
    expect(await setDataScenario(makeWriteSafe(new QueryClient()))).toBe('kết quả máy chủ sau khi ghi');
  });

  it('invalidateQueries không có bộ lọc và query không liên quan vẫn hoạt động bình thường', async () => {
    const qc = makeWriteSafe(new QueryClient());
    qc.setQueryData(['a'], 1);
    await expect(qc.invalidateQueries()).resolves.toBeUndefined();
    await expect(qc.invalidateQueries({ queryKey: ['khong-co'] })).resolves.toBeUndefined();
    expect(qc.getQueryData(['a'])).toBe(1);
  });
});
