// E2E (supertest) PermissionsGuard trên aurelia_test: mọi route /api/admin/* phải gắn quyền (quét metadata);
// quyền là hằng số ROLE_PERMISSIONS theo users.role: admin đủ 6 quyền, khách bị chặn 403.
import { INestApplication, RequestMethod } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PERMISSIONS_KEY, PERMISSION_CODES } from '../src/common/decorators/permissions.decorator';
import { ROLE_PERMISSIONS } from '../src/common/auth/role-permissions';

describe('PermissionsGuard (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('admin có đủ 6 quyền (ROLE_PERMISSIONS); user không có quyền nào', () => {
    expect([...ROLE_PERMISSIONS.admin].sort()).toEqual([...PERMISSION_CODES].sort());
    expect(ROLE_PERMISSIONS.user).toHaveLength(0);
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
    expect(scanned).toBeGreaterThan(80);
    expect(missing).toEqual([]);
  });

  it('khách (không có vai trò admin) vẫn bị RolesGuard chặn 403; chưa đăng nhập 401', async () => {
    const c = await http.post('/api/auth/login').send({ email: 'khachhang@aurelia.vn', password: '123456' });
    const t = c.body.data.tokens.accessToken;
    expect((await http.get('/api/admin/products').set('Authorization', `Bearer ${t}`)).status).toBe(403);
    expect((await http.get('/api/admin/products')).status).toBe(401);
  });
});
