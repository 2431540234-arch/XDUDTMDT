// Ngày theo giờ Việt Nam. Các mốc 17:30 UTC = 00:30 giờ Việt Nam của NGÀY SAU: khung 00:00–07:00 (giờ VN) là lúc ngày UTC còn là
// hôm qua, nơi từng sai một ngày. Mỗi kiểm tra chạy dưới nhiều múi giờ của MÁY (TZ) vì mã cũ phụ thuộc múi giờ máy.
import { AdminSpaceStatsService } from '../../modules/admin-stats/admin-space-stats.service';
import { AdminStatsService } from '../../modules/admin-stats/admin-stats.service';
import { addDaysYmd, endOfDayVn, parseVnDate, startOfDayVn, vnDbDate, vnYmd } from './vn-date';

const ALL_FAKE_EXCEPT_DATE = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

const ZONES = ['Asia/Ho_Chi_Minh', 'UTC', 'America/Los_Angeles', 'Pacific/Auckland'];
// 00:30 ngày 09/11/2026 giờ VN (= 17:30 UTC ngày 08/11), 06:59 cùng ngày VN, 23:59:59 ngày 08/11 VN, 00:00:00 ngày 09/11 VN
const NIGHT = '2026-11-08T17:30:00Z';

describe.each(ZONES)('ngày giờ Việt Nam khi múi giờ máy là %s', (zone) => {
  const oldTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = zone;
  });
  afterEach(() => {
    jest.useRealTimers();
    if (oldTz === undefined) delete process.env.TZ;
    else process.env.TZ = oldTz;
  });

  it('vnYmd / vnDbDate / start-end of day ở các biên 00:00 và 23:59:59', () => {
    expect(vnYmd(new Date(NIGHT))).toBe('2026-11-09');
    expect(vnYmd(new Date('2026-11-08T16:59:59.999Z'))).toBe('2026-11-08'); // 23:59:59.999 VN
    expect(vnYmd(new Date('2026-11-08T17:00:00.000Z'))).toBe('2026-11-09'); // 00:00:00.000 VN
    expect(vnYmd(new Date('2026-11-09T06:59:59Z'))).toBe('2026-11-09'); // 13:59 VN
    // giá trị ghi cột DATE: ngày VN, lúc 00:00 UTC (Prisma lấy phần ngày UTC)
    expect(vnDbDate(new Date(NIGHT)).toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(startOfDayVn('2026-11-09').toISOString()).toBe('2026-11-08T17:00:00.000Z');
    expect(endOfDayVn('2026-11-09').toISOString()).toBe('2026-11-09T16:59:59.999Z');
    expect(addDaysYmd('2026-11-09', -29)).toBe('2026-10-11');
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysYmd('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('parseVnDate: chỉ có ngày ⇒ giờ VN (đầu/cuối ngày); có giờ ⇒ giữ nguyên; sai ⇒ Invalid Date', () => {
    expect(parseVnDate('2026-11-09', 'start').toISOString()).toBe('2026-11-08T17:00:00.000Z');
    expect(parseVnDate('2026-11-09', 'end').toISOString()).toBe('2026-11-09T16:59:59.999Z');
    expect(parseVnDate('2026-11-09T10:00:00Z', 'end').toISOString()).toBe('2026-11-09T10:00:00.000Z');
    expect(Number.isNaN(parseVnDate('abc', 'start').getTime())).toBe(true);
  });

  it('thống kê tổng quan/thu chi: khoảng mặc định 30 ngày kết thúc ở NGÀY VN hiện tại (00:30 VN)', () => {
    jest.useFakeTimers({ now: new Date(NIGHT), doNotFake: [...ALL_FAKE_EXCEPT_DATE] });
    const r = new AdminStatsService(null as never, null as never, null as never).range({});
    expect(r.to).toBe('2026-11-09');
    expect(r.from).toBe('2026-10-11'); // đủ 30 ngày tính cả hôm nay
    expect(r.start.toISOString()).toBe('2026-10-10T17:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-09T16:59:59.999Z');
  });

  it('phễu không gian: khoảng mặc định cùng quy tắc; truyền from/to thì dùng đúng ngày VN', async () => {
    jest.useFakeTimers({ now: new Date(NIGHT), doNotFake: [...ALL_FAKE_EXCEPT_DATE] });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      space: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn() },
    };
    const svc = new AdminSpaceStatsService(prisma as never);
    const d = await svc.funnel({});
    expect(d).toMatchObject({ from: '2026-10-11', to: '2026-11-09' });
    // tham số cho truy vấn: [start, end] là mốc VN (đầu ngày from, cuối ngày to)
    const args = prisma.$queryRaw.mock.calls[0][0].values as Date[];
    expect(args[0].toISOString()).toBe('2026-10-10T17:00:00.000Z');
    expect(args[1].toISOString()).toBe('2026-11-09T16:59:59.999Z');
  });
});
