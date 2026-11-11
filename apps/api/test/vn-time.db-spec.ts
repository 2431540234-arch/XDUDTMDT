// E2E (supertest) ngày theo GIỜ VIỆT NAM trên aurelia_test, tập trung khung 00:00–07:00 giờ VN (ngày UTC còn là hôm qua):
// lọc nhật ký hoạt động theo ngày, phễu không gian ở sát nửa đêm, hạn dùng mã giảm giá chỉ nhập ngày. (Hoàn tiền sinh phiếu chi lúc
// 00:30 giờ VN nằm ở mock-m4.db-spec.ts; khoảng mặc định 30 ngày và các hàm ngày nằm ở src/common/utils/vn-date.spec.ts.)
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('Ngày theo giờ Việt Nam (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  const get = (path: string) => http.get(`/api${path}`).set('Authorization', `Bearer ${admin}`);

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await http
      .post('/api/auth/login')
      .send({ email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true });
    admin = r.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('nhật ký hoạt động: lọc ngày chỉ có ngày ⇒ theo ngày VN (00:30 VN thuộc ngày VN đó, không thuộc ngày trước)', async () => {
    const targetType = `vn-time-${Date.now()}`;
    const mk = (id: number, at: string) =>
      prisma.activityLog.create({
        data: { action: 'vn.time', targetType, targetId: id, changes: {}, createdAt: new Date(at) },
      });
    await mk(1, '2030-03-15T23:30:00+07:00'); // cuối ngày 15 VN (16:30 UTC ngày 15)
    await mk(2, '2030-03-16T00:30:00+07:00'); // 00:30 ngày 16 VN = 17:30 UTC ngày 15
    await mk(3, '2030-03-16T23:30:00+07:00'); // cuối ngày 16 VN
    await mk(4, '2030-03-17T00:00:00+07:00'); // đầu ngày 17 VN
    const ids = async (from: string, to: string) =>
      (
        (await get(`/admin/activity-logs?targetType=${targetType}&from=${from}&to=${to}&pageSize=50`)).body
          .data as Array<{
          targetId: number;
        }>
      )
        .map((r) => r.targetId)
        .sort();
    expect(await ids('2030-03-16', '2030-03-16')).toEqual([2, 3]); // trước khi sửa (lọc theo UTC): [1, 2]
    expect(await ids('2030-03-15', '2030-03-15')).toEqual([1]);
    expect(await ids('2030-03-17', '2030-03-17')).toEqual([4]);
    expect(await ids('2030-03-15', '2030-03-17')).toEqual([1, 2, 3, 4]);
    await prisma.activityLog.deleteMany({ where: { targetType } });
  });

  it('phễu không gian: lượt xem lúc 00:30 và 23:30 giờ VN tính đúng ngày VN', async () => {
    const stamp = Date.now();
    const sp = await prisma.space.create({
      data: {
        title: `Giờ VN ${stamp}`,
        slug: `gio-vn-${stamp}`,
        roomType: 'living_room',
        status: 'published',
      },
    });
    const at = (iso: string) => new Date(iso);
    for (const [i, t] of [
      '2030-03-15T23:30:00+07:00',
      '2030-03-16T00:30:00+07:00',
      '2030-03-16T23:30:00+07:00',
      '2030-03-17T00:00:00+07:00',
    ].entries())
      await prisma.spaceView.create({
        data: {
          spaceId: sp.id,
          visitorId: randomUUID(),
          hotspotClickCount: i,
          addedToCart: false,
          createdAt: at(t),
        },
      });
    const one = async (d: string) => {
      const r = await get(`/admin/stats/spaces?from=${d}&to=${d}`);
      expect(r.status).toBe(200);
      return r.body.data.spaces.find((s: { spaceId: number }) => s.spaceId === sp.id)?.views ?? 0;
    };
    expect(await one('2030-03-15')).toBe(1);
    expect(await one('2030-03-16')).toBe(2); // 00:30 và 23:30 giờ VN
    expect(await one('2030-03-17')).toBe(1);
    await prisma.spaceView.deleteMany({ where: { spaceId: sp.id } });
    await prisma.space.delete({ where: { id: sp.id } });
  });

  it('mã giảm giá: chỉ nhập ngày ⇒ bắt đầu 00:00 và hết hạn 23:59:59 giờ VN của ngày đó', async () => {
    const r = await http
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        name: 'Hạn giờ VN',
        code: `VNT${Date.now() % 100000}`,
        kind: 'percent',
        value: 10,
        maxDiscount: 100_000,
        minOrderValue: 0,
        usageLimit: 5,
        startsAt: '2030-03-16',
        endsAt: '2030-03-18',
      });
    expect(r.status).toBe(201);
    expect(r.body.data.startsAt).toBe('2030-03-15T17:00:00.000Z'); // 00:00 ngày 16/03 giờ VN
    expect(r.body.data.endsAt).toBe('2030-03-18T16:59:59.999Z'); // 23:59:59.999 ngày 18/03 giờ VN
    // gửi cả giờ thì giữ nguyên
    const iso = await http
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        name: 'Hạn có giờ',
        code: `VNU${Date.now() % 100000}`,
        kind: 'percent',
        value: 10,
        maxDiscount: 100_000,
        minOrderValue: 0,
        usageLimit: 5,
        startsAt: '2030-03-16T01:00:00Z',
        endsAt: '2030-03-18T05:00:00Z',
      });
    expect(iso.status).toBe(201);
    expect(iso.body.data.startsAt).toBe('2030-03-16T01:00:00.000Z');
    // kết thúc cùng ngày bắt đầu (chỉ ngày) vẫn hợp lệ: cả ngày
    const same = await http
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        name: 'Một ngày',
        code: `VNV${Date.now() % 100000}`,
        kind: 'percent',
        value: 10,
        maxDiscount: 100_000,
        minOrderValue: 0,
        usageLimit: 5,
        startsAt: '2030-03-16',
        endsAt: '2030-03-16',
      });
    expect(same.status).toBe(201);
    await prisma.coupon.deleteMany({
      where: { id: { in: [r.body.data.id, iso.body.data.id, same.body.data.id] } },
    });
  });
});
