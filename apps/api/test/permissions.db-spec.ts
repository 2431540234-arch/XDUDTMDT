// E2E (supertest) PermissionsGuard trên aurelia_test: mọi route /api/admin/* phải gắn quyền (quét metadata);
// gỡ một dòng role_permissions ⇒ route tương ứng 403 (tiếng Việt), route khác vẫn chạy. Dữ liệu được khôi phục sau mỗi test.
import { INestApplication, RequestMethod } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PERMISSIONS_KEY, PERMISSION_CODES } from '../src/common/decorators/permissions.decorator';
import { PermissionsService } from '../src/common/guards/permissions.guard';

describe('PermissionsGuard (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let perms: PermissionsService;
  const prisma = new PrismaClient();
  let admin = '';
  let adminRoleId = 0;

  const call = (method: 'get' | 'post' | 'patch', path: string) =>
    (http as never as Record<string, (u: string) => request.Test>)
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${admin}`);
  const permId = async (code: string) => (await prisma.permission.findFirstOrThrow({ where: { code } })).id;
  /** Gỡ tạm quyền khỏi vai trò admin, chạy fn, rồi luôn khôi phục */
  const without = async (code: string, fn: () => Promise<void>) => {
    const permissionId = await permId(code);
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: adminRoleId, permissionId } },
    });
    perms.clearCache();
    try {
      await fn();
    } finally {
      await prisma.rolePermission.create({ data: { roleId: adminRoleId, permissionId } });
      perms.clearCache();
    }
  };

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    perms = app.get(PermissionsService);
    adminRoleId = (await prisma.role.findFirstOrThrow({ where: { code: 'admin' } })).id;
    const r = await http
      .post('/api/auth/login')
      .send({ email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true });
    admin = r.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    perms?.clearCache();
    await prisma.$disconnect();
    await app?.close();
  });

  it('admin có đủ 6 quyền trong role_permissions (hành vi hiện tại không đổi)', async () => {
    const rows = await prisma.rolePermission.findMany({
      where: { roleId: adminRoleId },
      include: { permission: true },
    });
    expect(rows.map((r) => r.permission.code).sort()).toEqual([...PERMISSION_CODES].sort());
  });

  it('quét metadata: MỌI route /api/admin/* đều gắn @RequirePermission với mã quyền hợp lệ', () => {
    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const missing: string[] = [];
    let scanned = 0;
    for (const w of discovery.getControllers()) {
      const cls = w.metatype as (new (...a: never[]) => object) | null;
      if (!cls) continue;
      const base = String(Reflect.getMetadata('path', cls) ?? '');
      if (!/^\/?admin(\/|$)/.test(base)) continue;
      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        const handler = (cls.prototype as Record<string, unknown>)[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const method = Reflect.getMetadata('method', handler);
        if (method === undefined) continue; // không phải route
        scanned++;
        const codes = reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
          handler as never,
          cls,
        ]);
        const route = `${RequestMethod[method]} /${base}/${Reflect.getMetadata('path', handler) ?? ''}`;
        if (!codes?.length || !codes.every((c) => (PERMISSION_CODES as readonly string[]).includes(c)))
          missing.push(route);
      }
    }
    expect(scanned).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  it('gỡ manage_products ⇒ route sản phẩm 403 (tiếng Việt), route đơn hàng/nội dung vẫn chạy', async () => {
    expect((await call('get', '/admin/products')).status).toBe(200);
    await without('manage_products', async () => {
      const r = await call('get', '/admin/products');
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
      expect(r.body.error.message).toBe('Bạn không có quyền "Quản lý sản phẩm" để thực hiện thao tác này.');
      expect((await call('get', '/admin/models')).status).toBe(403);
      expect((await call('get', '/admin/brands')).status).toBe(403);
      expect((await call('get', '/admin/orders')).status).toBe(200);
      expect((await call('get', '/admin/banners')).status).toBe(200);
    });
    expect((await call('get', '/admin/products')).status).toBe(200); // đã khôi phục
  });

  it('quyền theo từng route: xem đơn (view_orders) tách khỏi xử lý đơn (process_orders)', async () => {
    await without('view_orders', async () => {
      expect((await call('get', '/admin/orders')).status).toBe(403);
      expect((await call('get', '/admin/orders/counts')).status).toBe(403);
      expect((await call('get', '/admin/stats/overview')).status).toBe(403);
      // ghi đơn vẫn qua cổng quyền (404 vì không có đơn, KHÔNG phải 403)
      expect(
        (await call('patch', '/admin/orders/99999999/status').send({ status: 'confirmed' })).status,
      ).toBe(404);
    });
    await without('process_orders', async () => {
      expect((await call('get', '/admin/orders')).status).toBe(200);
      expect(
        (await call('patch', '/admin/orders/99999999/status').send({ status: 'confirmed' })).status,
      ).toBe(403);
      expect((await call('post', '/admin/orders/99999999/cancel').send({ reason: 'x' })).status).toBe(403);
      expect((await call('get', '/admin/returns')).status).toBe(403);
    });
  });

  it('route nhận nhiều quyền (media: manage_products HOẶC manage_content): còn một trong hai là đủ', async () => {
    await without('manage_products', async () => {
      expect((await call('get', '/admin/media')).status).toBe(200);
      await without('manage_content', async () => {
        const r = await call('get', '/admin/media');
        expect(r.status).toBe(403);
        expect(r.body.error.message).toContain('hoặc');
      });
    });
  });

  it('manage_users, manage_settings, manage_content gắn đúng nhóm route', async () => {
    await without('manage_users', async () => {
      expect((await call('get', '/admin/users')).status).toBe(403);
    });
    await without('manage_settings', async () => {
      expect((await call('get', '/admin/settings')).status).toBe(403);
    });
    await without('manage_content', async () => {
      expect((await call('get', '/admin/reviews')).status).toBe(403);
      expect((await call('get', '/admin/coupons')).status).toBe(403);
      expect((await call('get', '/admin/spaces')).status).toBe(403);
    });
    expect((await call('get', '/admin/users')).status).toBe(200);
  });

  it('khách (không có vai trò admin) vẫn bị RolesGuard chặn 403; chưa đăng nhập 401', async () => {
    const c = await http.post('/api/auth/login').send({ email: 'khachhang@aurelia.vn', password: '123456' });
    const t = c.body.data.tokens.accessToken;
    expect((await http.get('/api/admin/products').set('Authorization', `Bearer ${t}`)).status).toBe(403);
    expect((await http.get('/api/admin/products')).status).toBe(401);
  });
});
