// E2E (supertest) ActivityLogInterceptor trên aurelia_test: lưới an toàn cho request ghi của admin.
//  • route đã ghi log trong service ⇒ đúng 1 dòng (không ghi trùng); • route không ghi ⇒ interceptor ghi 1 dòng chung;
//  • request lỗi ⇒ không ghi; • request đọc và request của khách ⇒ không ghi.
// Dùng controller thử (admin/__interceptor-test) gắn vào app để điều khiển chính xác việc service có ghi log hay không.
import { Controller, Get, INestApplication, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import request from 'supertest';
import { ActivityLogService } from '../src/activity-log/activity-log.service';
import { describeRoute } from '../src/activity-log/activity-log.interceptor';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CurrentUser, Roles } from '../src/common/decorators/auth.decorators';
import { RequirePermission } from '../src/common/decorators/permissions.decorator';
import { AppException } from '../src/common/exceptions/app.exception';

@Roles('admin')
@RequirePermission('manage_settings')
@Controller('admin/__interceptor-test')
class InterceptorTestController {
  constructor(private readonly activity: ActivityLogService) {}

  /** service TỰ ghi log (như mọi service thật) */
  @Post('logged/:id')
  async logged(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    await this.activity.log({ actorId: adminId, action: 'test.logged', targetType: 'itest', targetId: id });
    return { ok: true };
  }

  /** service KHÔNG ghi log */
  @Post('silent/:id')
  silent() {
    return { ok: true };
  }

  @Patch('silent/:id/approve')
  approve() {
    return { ok: true };
  }

  @Post('boom/:id')
  boom() {
    throw new AppException(ErrorCode.CONFLICT, 'Lỗi thử nghiệm.');
  }

  @Get('read/:id')
  read() {
    return { ok: true };
  }
}

describe('ActivityLogInterceptor (aurelia_test)', () => {
  // id đích riêng cho mỗi lần chạy: nhật ký từ lần chạy trước không lẫn vào kết quả
  const B = 900_000_000 + (Date.now() % 90_000_000);
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let adminId = 0;

  const post = (path: string, token = admin) =>
    http.post(`/api${path}`).set('Authorization', `Bearer ${token}`).send({});
  const logsFor = (targetType: string, targetId: number) =>
    prisma.activityLog.findMany({ where: { targetType, targetId }, orderBy: { id: 'asc' } });

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [InterceptorTestController],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await http
      .post('/api/auth/login')
      .send({ email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true });
    admin = r.body.data.tokens.accessToken;
    adminId = (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('route đã có log trong service ⇒ đúng 1 dòng (service), interceptor bỏ qua', async () => {
    expect((await post(`/admin/__interceptor-test/logged/${B + 1}`)).status).toBe(201);
    const rows = await logsFor('itest', B + 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'test.logged', actorId: adminId });
    expect(rows[0].changes).toBeNull(); // không phải dòng tự động
  });

  it('route thật có log trong service (POST /admin/brands) ⇒ đúng 1 dòng, không có dòng tự động', async () => {
    const before = await prisma.activityLog.count({ where: { action: { startsWith: 'brands.' } } });
    const r = await http
      .post('/api/admin/brands')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: `Thương hiệu interceptor ${Date.now()}` });
    expect(r.status).toBe(201);
    const id = r.body.data.id as number;
    const rows = await prisma.activityLog.findMany({
      where: { targetId: id, action: { contains: 'brand' } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].changes).not.toMatchObject({ auto: true });
    expect(await prisma.activityLog.count({ where: { action: { startsWith: 'brands.' } } })).toBe(before);
  });

  it('route KHÔNG ghi log trong service ⇒ interceptor ghi đúng 1 dòng chung (actor, action theo route, target, IP)', async () => {
    expect((await post(`/admin/__interceptor-test/silent/${B + 2}`)).status).toBe(201);
    const rows = await logsFor('__interceptor-test', B + 2);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: adminId,
      action: '__interceptor-test.create',
      targetType: '__interceptor-test',
      targetId: B + 2,
    });
    expect(rows[0].changes).toMatchObject({ auto: true, method: 'POST' });
    expect(rows[0].ipAddress).toBeTruthy();

    // route có động từ cuối đường dẫn lấy làm hành động
    const r = await http
      .patch(`/api/admin/__interceptor-test/silent/${B + 3}/approve`)
      .set('Authorization', `Bearer ${admin}`)
      .send({});
    expect(r.status).toBe(200);
    const rows2 = await logsFor('__interceptor-test', B + 3);
    expect(rows2).toHaveLength(1);
    expect(rows2[0].action).toBe('__interceptor-test.approve');
  });

  it('request lỗi ⇒ không ghi dòng nào', async () => {
    expect((await post(`/admin/__interceptor-test/boom/${B + 4}`)).status).toBe(409);
    expect(await logsFor('__interceptor-test', B + 4)).toHaveLength(0);
    expect(await logsFor('itest', B + 4)).toHaveLength(0);
  });

  it('request đọc (GET) và request ghi của khách ⇒ không ghi', async () => {
    const r = await http
      .get(`/api/admin/__interceptor-test/read/${B + 5}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(r.status).toBe(200);
    expect(await logsFor('__interceptor-test', B + 5)).toHaveLength(0);

    const c = await http.post('/api/auth/login').send({ email: 'khachhang@aurelia.vn', password: '123456' });
    const token = c.body.data.tokens.accessToken;
    const before = await prisma.activityLog.count({ where: { changes: { path: ['auto'], equals: true } } });
    await http.delete('/api/cart').set('Authorization', `Bearer ${token}`);
    expect((await post(`/admin/__interceptor-test/silent/${B + 6}`, token)).status).toBe(403);
    expect(await prisma.activityLog.count({ where: { changes: { path: ['auto'], equals: true } } })).toBe(
      before,
    );
    expect(await logsFor('__interceptor-test', B + 6)).toHaveLength(0);
  });

  it('describeRoute: đặt tên hành động theo route', () => {
    expect(describeRoute('POST', '/api/admin/orders/:id/cancel')).toEqual({
      resource: 'orders',
      action: 'orders.cancel',
    });
    expect(describeRoute('DELETE', '/api/admin/brands/:id')).toEqual({
      resource: 'brands',
      action: 'brands.delete',
    });
    expect(describeRoute('PATCH', '/api/admin/banners/reorder').action).toBe('banners.reorder');
    expect(describeRoute('PUT', '/api/admin/faq').action).toBe('faq.update');
    expect(describeRoute('POST', '/api/admin/orders/:id/shipments').action).toBe('orders.shipments');
  });
});
