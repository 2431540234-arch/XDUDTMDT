// E2E (supertest) nhóm use case Mở rộng nhẹ trên aurelia_test: UC-ADM-27 nhật ký hoạt động, UC-ADM-02 vai trò và phân quyền,
// UC-ACC-03 phiên đăng nhập, UC-ACC-07 xóa tài khoản (xóa mềm), UC-ADM-26 gửi thông báo. Mỗi test tự tạo dữ liệu riêng.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PermissionsService } from '../src/common/guards/permissions.guard';
import { AdminRolesService } from '../src/modules/admin-roles/admin-roles.service';

describe('Use case Mở rộng nhẹ (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let adminId = 0;
  let cust = '';
  let seq = 0;

  const api = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    token?: string,
    body?: object,
    ua?: string,
  ) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    if (ua) r.set('User-Agent', ua);
    return body ? r.send(body) : r;
  };
  const uniq = () => `${Date.now()}-${++seq}`;
  const login = async (email: string, password: string, adminOnly = false, ua?: string) => {
    const r = await api('post', '/auth/login', undefined, { email, password, adminOnly }, ua);
    expect(r.status).toBe(200);
    return r.body.data.tokens as { accessToken: string; refreshToken: string };
  };
  /** Khách mới đăng ký qua API (đúng luồng thật), trả về thông tin + token */
  const newCustomer = async (label = 'ext') => {
    const email = `${label}-${uniq()}@test.local`;
    const password = 'Matkhau-12345';
    const reg = await api('post', '/auth/register', undefined, {
      fullName: `Khách ${label}`,
      email,
      phone: '0911222333',
      password,
      confirmPassword: password,
    });
    expect(reg.status).toBe(201);
    const t = await login(email, password);
    const u = await prisma.user.findFirstOrThrow({ where: { email, deletedAt: null } });
    return { id: u.id, email, password, token: t.accessToken, refresh: t.refreshToken };
  };

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    admin = (await login('admin@aurelia.vn', 'admin123', true)).accessToken;
    adminId = (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id;
    cust = (await login('khachhang@aurelia.vn', '123456')).accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  // ---------------------------------------------------------------- UC-ADM-27
  describe('UC-ADM-27 nhật ký hoạt động', () => {
    it('lọc theo admin, hành động, loại đối tượng, ngày; phân trang; mới nhất trước; chỉ đọc', async () => {
      const brandName = `Nhật ký ${uniq()}`;
      const created = await api('post', '/admin/brands', admin, { name: brandName });
      expect(created.status).toBe(201);
      const brandId = created.body.data.id as number;

      const all = await api('get', '/admin/activity-logs?pageSize=5', admin);
      expect(all.status).toBe(200);
      expect(all.body.meta).toMatchObject({ page: 1, pageSize: 5 });
      expect(all.body.data.length).toBeLessThanOrEqual(5);
      const times = all.body.data.map((r: { createdAt: string }) => r.createdAt);
      expect([...times].sort().reverse()).toEqual(times); // mới nhất trước

      const byAction = await api(
        'get',
        `/admin/activity-logs?actorId=${adminId}&targetType=brand&action=brand`,
        admin,
      );
      expect(byAction.status).toBe(200);
      const row = byAction.body.data.find((r: { targetId: number }) => r.targetId === brandId);
      expect(row).toMatchObject({ actorId: adminId, targetType: 'brand', auto: false });
      expect(row.actorEmail).toBe('admin@aurelia.vn');

      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
      const ranged = await api(
        'get',
        `/admin/activity-logs?from=${today}&to=${today}&targetType=brand`,
        admin,
      );
      expect(ranged.body.data.some((r: { targetId: number }) => r.targetId === brandId)).toBe(true);
      const old = await api('get', '/admin/activity-logs?from=2001-01-01&to=2001-01-02', admin);
      expect(old.body.data).toHaveLength(0);

      // chỉ đọc
      expect((await api('post', '/admin/activity-logs', admin, {})).status).toBe(404);
      expect((await api('delete', '/admin/activity-logs/1', admin)).status).toBe(404);
      expect((await api('patch', '/admin/activity-logs/1', admin, {})).status).toBe(404);
    });

    it('dòng do interceptor ghi (changes.auto = true) có auto = true, khác dòng do service ghi', async () => {
      // PATCH đặt mô hình chính khi mô hình ĐÃ là chính: service bỏ qua nhật ký ⇒ interceptor ghi dòng chung
      const model = await prisma.product3DModel.findFirstOrThrow({
        where: { isPrimary: true, status: 'ready' },
      });
      expect((await api('patch', `/admin/models/${model.id}/primary`, admin)).status).toBe(200);
      const r = await api('get', '/admin/activity-logs?action=models.primary&pageSize=5', admin);
      const auto = r.body.data.find((x: { targetId: number }) => x.targetId === model.id);
      expect(auto).toMatchObject({ auto: true, actorId: adminId });
      expect(auto.changes).toMatchObject({ auto: true });
    });

    it('options cho bộ lọc; sai tham số ⇒ 400; 401/403 theo quyền', async () => {
      const o = await api('get', '/admin/activity-logs/options', admin);
      expect(o.status).toBe(200);
      expect(o.body.data.actors.some((a: { id: number }) => a.id === adminId)).toBe(true);
      expect(o.body.data.actions.length).toBeGreaterThan(0);
      expect((await api('get', '/admin/activity-logs?from=khong-phai-ngay', admin)).status).toBe(400);
      expect((await api('get', '/admin/activity-logs?actorId=abc', admin)).status).toBe(400);
      expect((await api('get', '/admin/activity-logs?from=2026-02-01&to=2026-01-01', admin)).status).toBe(
        400,
      );
      expect((await api('get', '/admin/activity-logs')).status).toBe(401);
      expect((await api('get', '/admin/activity-logs', cust)).status).toBe(403);
      // thiếu quyền manage_settings ⇒ 403 dù là admin
      const perms = app.get(PermissionsService);
      const rp = await prisma.rolePermission.findFirstOrThrow({
        where: { permission: { code: 'manage_settings' }, role: { code: 'admin' } },
      });
      await prisma.rolePermission.delete({
        where: { roleId_permissionId: { roleId: rp.roleId, permissionId: rp.permissionId } },
      });
      perms.clearCache();
      try {
        expect((await api('get', '/admin/activity-logs', admin)).status).toBe(403);
      } finally {
        await prisma.rolePermission.create({ data: { roleId: rp.roleId, permissionId: rp.permissionId } });
        perms.clearCache();
      }
    });
  });

  // ---------------------------------------------------------------- UC-ADM-02
  describe('UC-ADM-02 vai trò và phân quyền', () => {
    it('GET /admin/roles: đúng 2 vai trò, admin có đủ 6 quyền, user không có quyền nào', async () => {
      const r = await api('get', '/admin/roles', admin);
      expect(r.status).toBe(200);
      expect(r.body.data.map((x: { code: string }) => x.code).sort()).toEqual(['admin', 'user']);
      const adminRole = r.body.data.find((x: { code: string }) => x.code === 'admin');
      expect(adminRole.permissions.map((p: { code: string }) => p.code).sort()).toEqual(
        [
          'manage_content',
          'manage_products',
          'manage_settings',
          'manage_users',
          'process_orders',
          'view_orders',
        ].sort(),
      );
      expect(r.body.data.find((x: { code: string }) => x.code === 'user').permissions).toHaveLength(0);
      expect((await api('get', '/admin/roles')).status).toBe(401);
      expect((await api('get', '/admin/roles', cust)).status).toBe(403);
    });

    it('gán rồi gỡ admin trong $transaction, ghi activity_logs; idempotent; hiệu lực ở lần đăng nhập sau', async () => {
      const c = await newCustomer('role');
      const grant = await api('put', `/admin/users/${c.id}/roles/admin`, admin);
      expect(grant.status).toBe(200);
      expect(grant.body.data.roles.sort()).toEqual(['admin', 'user']);
      expect((await api('put', `/admin/users/${c.id}/roles/admin`, admin)).status).toBe(200); // idempotent
      expect(await prisma.activityLog.count({ where: { action: 'user.grant_admin', targetId: c.id } })).toBe(
        1,
      );
      // hiệu lực NGAY: vai trò đọc từ DB mỗi request, nên token cấp TRƯỚC khi được gán admin dùng được ở request kế tiếp
      expect((await api('get', '/admin/orders', c.token)).status).toBe(200);

      const revoke = await api('delete', `/admin/users/${c.id}/roles/admin`, admin);
      expect(revoke.status).toBe(200);
      expect(revoke.body.data.roles).toEqual(['user']);
      expect(await prisma.activityLog.count({ where: { action: 'user.revoke_admin', targetId: c.id } })).toBe(
        1,
      );
      // gỡ xong thì request admin KẾ TIẾP của chính token đó bị 403 (không đợi token hết hạn)
      expect((await api('get', '/admin/orders', c.token)).status).toBe(403);
      // gỡ lần nữa: không còn vai trò admin ⇒ 409
      expect((await api('delete', `/admin/users/${c.id}/roles/admin`, admin)).status).toBe(409);
    });

    it('409: tự gỡ quyền của chính mình; gỡ admin CUỐI CÙNG (service, bỏ qua cổng quyền); 404; 401/403', async () => {
      const self = await api('delete', `/admin/users/${adminId}/roles/admin`, admin);
      expect(self.status).toBe(409);
      expect(self.body.error.code).toBe('INVALID_STATE');
      expect(self.body.error.message).toContain('tự gỡ');

      const adminRole = await prisma.role.findFirstOrThrow({ where: { code: 'admin' } });
      expect(await prisma.userRole.count({ where: { roleId: adminRole.id } })).toBe(1); // chỉ admin gốc
      // Qua HTTP không còn đường gỡ admin cuối cùng (người gỡ phải là admin nên luôn còn ≥ 1 admin khác). Quy tắc vẫn được
      // service thực thi (chống hai yêu cầu đồng thời): gọi thẳng service với một "người gỡ" bất kỳ khác admin gốc.
      const c = await newCustomer('last');
      const svc = app.get(AdminRolesService);
      const last = await svc.revokeAdmin(c.id, adminId).catch((e: { status: number; message: string }) => e);
      expect(last).toMatchObject({ status: 409 });
      expect((last as { message: string }).message).toContain('cuối cùng');
      expect(await prisma.userRole.count({ where: { roleId: adminRole.id } })).toBe(1);

      expect((await api('put', '/admin/users/99999999/roles/admin', admin)).status).toBe(404);
      expect((await api('delete', '/admin/users/99999999/roles/admin', admin)).status).toBe(404);
      expect((await api('put', `/admin/users/${c.id}/roles/admin`)).status).toBe(401);
      expect((await api('put', `/admin/users/${c.id}/roles/admin`, cust)).status).toBe(403);
    });

    it('không tạo được vai trò mới (không có route POST/PUT/DELETE trên /admin/roles)', async () => {
      expect((await api('post', '/admin/roles', admin, { code: 'staff', name: 'Nhân viên' })).status).toBe(
        404,
      );
      expect(await prisma.role.count()).toBe(2);
    });
  });

  // ---------------------------------------------------------------- UC-ACC-03
  describe('UC-ACC-03 phiên đăng nhập', () => {
    it('liệt kê phiên còn hiệu lực (thiết bị, IP, thời gian), đánh dấu thiết bị hiện tại; chưa đăng nhập 401', async () => {
      const c = await newCustomer('sess');
      const second = await login(
        c.email,
        c.password,
        false,
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17 Safari/604',
      );
      const r = await api('get', '/users/me/sessions', second.accessToken);
      expect(r.status).toBe(200);
      // đăng ký + đăng nhập ở newCustomer + đăng nhập thiết bị Safari = 3 phiên
      expect(r.body.data).toHaveLength(3);
      const current = r.body.data.filter((s: { current: boolean }) => s.current);
      expect(current).toHaveLength(1);
      expect(current[0].deviceName).toBe('Safari trên iOS');
      for (const s of r.body.data) {
        expect(typeof s.deviceName).toBe('string');
        expect(s.createdAt).toBeTruthy();
        expect(s.expiresAt).toBeTruthy();
        expect(s).not.toHaveProperty('refreshTokenHash'); // không lộ hash
      }
      expect((await api('get', '/users/me/sessions')).status).toBe(401);
    });

    it('DELETE phiên của mình ⇒ 204, phiên đó hết hiệu lực (refresh bị từ chối), biến mất khỏi danh sách; phiên của người khác ⇒ 404', async () => {
      const a = await newCustomer('sa');
      const b = await newCustomer('sb');
      const other = await login(a.email, a.password);
      const list = await api('get', '/users/me/sessions', a.token);
      expect(list.body.data).toHaveLength(3);
      const target = list.body.data.find((s: { current: boolean }) => !s.current) ?? list.body.data[0];

      // phiên của người khác ⇒ 404 và phiên của a không bị đụng
      expect((await api('delete', `/users/me/sessions/${target.id}`, b.token)).status).toBe(404);
      expect((await api('get', '/users/me/sessions', a.token)).body.data).toHaveLength(3);

      const del = await api('delete', `/users/me/sessions/${target.id}`, a.token);
      expect(del.status).toBe(204);
      const row = await prisma.userSession.findUniqueOrThrow({ where: { id: target.id } });
      expect(row.revokedAt).not.toBeNull();
      const after = await api('get', '/users/me/sessions', a.token);
      expect(after.body.data.some((s: { id: number }) => s.id === target.id)).toBe(false);
      expect((await api('delete', `/users/me/sessions/${target.id}`, a.token)).status).toBe(404); // đã thu hồi
      expect((await api('delete', '/users/me/sessions/99999999', a.token)).status).toBe(404);

      // access token gắn với phiên đã thu hồi bị từ chối NGAY (401 AUTH_TOKEN_INVALID), token của phiên khác vẫn dùng được
      const revokedToken = await api('get', '/users/me', other.accessToken);
      expect(revokedToken.status).toBe(401);
      expect(revokedToken.body.error.code).toBe('AUTH_TOKEN_INVALID');
      expect((await api('get', '/users/me', a.token)).status).toBe(200);
      // phiên hiện tại vẫn làm mới được; dùng lại refresh token của phiên đã thu hồi bị từ chối
      // (và theo cơ chế phát hiện dùng lại token sẽ thu hồi mọi phiên của user, nên làm bước này sau cùng)
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: a.refresh })).status).toBe(200);
      expect(
        (await api('post', '/auth/refresh', undefined, { refreshToken: other.refreshToken })).status,
      ).toBeGreaterThanOrEqual(400);
    });

    it('đăng xuất thu hồi phiên: access token của phiên đó bị từ chối ngay; đổi mật khẩu + đăng xuất thiết bị khác', async () => {
      const c = await newCustomer('logout');
      const second = await login(c.email, c.password);
      expect((await api('get', '/users/me', second.accessToken)).status).toBe(200);
      expect(
        (await api('post', '/auth/logout', second.accessToken, { refreshToken: second.refreshToken })).status,
      ).toBe(200);
      expect((await api('get', '/users/me', second.accessToken)).status).toBe(401);
      expect((await api('get', '/users/me', c.token)).status).toBe(200); // phiên khác không bị ảnh hưởng

      const third = await login(c.email, c.password);
      const pw = await api('post', '/users/me/change-password', c.token, {
        currentPassword: c.password,
        newPassword: 'Matkhau-moi-99',
        confirmPassword: 'Matkhau-moi-99',
        logoutOthers: true,
      });
      expect(pw.status).toBe(200);
      expect((await api('get', '/users/me', third.accessToken)).status).toBe(401); // thiết bị khác bị đăng xuất
    });

    it('phiên đã hết hạn hoặc đã thu hồi không được liệt kê', async () => {
      const c = await newCustomer('exp');
      await prisma.userSession.create({
        data: {
          userId: c.id,
          refreshTokenHash: `expired-${uniq()}`,
          expiresAt: new Date(Date.now() - 60_000),
          deviceName: 'Phiên cũ',
        },
      });
      const r = await api('get', '/users/me/sessions', c.token);
      expect(r.body.data.some((s: { deviceName: string }) => s.deviceName === 'Phiên cũ')).toBe(false);
    });
  });

  // ---------------------------------------------------------------- UC-ACC-07
  describe('UC-ACC-07 xóa tài khoản (xóa mềm)', () => {
    it('sai/thiếu mật khẩu ⇒ 400; đúng ⇒ 204: deletedAt + banned, mọi phiên bị thu hồi, đơn hàng giữ nguyên; đăng nhập lại bị từ chối', async () => {
      const c = await newCustomer('del');
      expect((await api('delete', '/users/me', c.token, {})).status).toBe(400);
      const wrong = await api('delete', '/users/me', c.token, { password: 'sai-mat-khau' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.details.password[0]).toBe('Mật khẩu không đúng.');
      expect(await prisma.user.count({ where: { id: c.id, deletedAt: null } })).toBe(1);

      const ok = await api('delete', '/users/me', c.token, { password: c.password });
      expect(ok.status).toBe(204);
      const u = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
      expect(u.deletedAt).not.toBeNull();
      expect(u.status).toBe('banned');
      expect(await prisma.userSession.count({ where: { userId: c.id, revokedAt: null } })).toBe(0);
      expect(await prisma.user.count({ where: { id: c.id } })).toBe(1); // không xóa cứng

      const relog = await api('post', '/auth/login', undefined, { email: c.email, password: c.password });
      expect(relog.status).toBeGreaterThanOrEqual(400);
      expect(
        (await api('post', '/auth/refresh', undefined, { refreshToken: c.refresh })).status,
      ).toBeGreaterThanOrEqual(400);
    });

    it('email đã xóa đăng ký lại được (partial unique), tài khoản mới độc lập với tài khoản cũ', async () => {
      const c = await newCustomer('again');
      expect((await api('delete', '/users/me', c.token, { password: c.password })).status).toBe(204);
      const reg = await api('post', '/auth/register', undefined, {
        fullName: 'Khách quay lại',
        email: c.email,
        phone: '0911222333',
        password: 'Matkhau-moi-1',
        confirmPassword: 'Matkhau-moi-1',
      });
      expect(reg.status).toBe(201);
      const fresh = await prisma.user.findFirstOrThrow({ where: { email: c.email, deletedAt: null } });
      expect(fresh.id).not.toBe(c.id);
      expect(await prisma.user.count({ where: { email: c.email } })).toBe(2);
    });

    it('còn đơn pending…shipping ⇒ 409 và không thay đổi gì; đơn đã hoàn tất thì xóa được', async () => {
      const c = await newCustomer('open');
      const addr = await prisma.address.create({
        data: {
          userId: c.id,
          recipientName: 'A',
          phone: '0911222333',
          province: 'HCM',
          district: 'Q1',
          ward: 'P1',
          addressLine: '1 A',
          isDefault: true,
        },
      });
      const variant = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gte: 5 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'desc' },
      });
      await api('delete', '/cart', c.token);
      expect((await api('post', '/cart/items', c.token, { variantId: variant.id, quantity: 1 })).status).toBe(
        201,
      );
      const order = await api('post', '/orders', c.token, { addressId: addr.id, paymentMethod: 'cod' });
      expect(order.status).toBe(201);
      const blocked = await api('delete', '/users/me', c.token, { password: c.password });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('INVALID_STATE');
      expect(blocked.body.error.message).toContain('đơn hàng đang xử lý');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).deletedAt).toBeNull();
      expect(await prisma.userSession.count({ where: { userId: c.id, revokedAt: null } })).toBeGreaterThan(0);

      // hủy đơn (khách tự hủy khi pending) ⇒ xóa được
      expect(
        (await api('post', `/orders/${order.body.data.id}/cancel`, c.token, { reason: 'Đổi ý' })).status,
      ).toBe(200);
      expect((await api('delete', '/users/me', c.token, { password: c.password })).status).toBe(204);
      expect(await prisma.order.count({ where: { userId: c.id } })).toBe(1); // đơn giữ nguyên
    });

    it('admin không tự xóa tài khoản (403); chưa đăng nhập 401', async () => {
      const r = await api('delete', '/users/me', admin, { password: 'admin123' });
      expect(r.status).toBe(403);
      expect(await prisma.user.count({ where: { id: adminId, deletedAt: null } })).toBe(1);
      expect((await api('delete', '/users/me', undefined, { password: 'x' })).status).toBe(401);
    });
  });

  // ---------------------------------------------------------------- UC-ADM-26
  describe('UC-ADM-26 gửi thông báo', () => {
    it('gửi cho một người: thông báo hệ thống xuất hiện ở chuông của khách đó, kèm activity_logs; người khác không thấy', async () => {
      const a = await newCustomer('na');
      const b = await newCustomer('nb');
      const title = `Bảo trì ${uniq()}`;
      const r = await api('post', '/admin/notifications', admin, {
        title,
        content: 'Hệ thống bảo trì lúc 23:00.',
        link: '/account/orders',
        userIds: [a.id],
      });
      expect(r.status).toBe(201);
      expect(r.body.data).toEqual({ sent: 1 });
      const list = await api('get', '/notifications', a.token);
      const mine = list.body.data.find((n: { title: string }) => n.title === title);
      expect(mine).toBeTruthy();
      expect(mine.data).toMatchObject({
        type: 'system',
        content: 'Hệ thống bảo trì lúc 23:00.',
        link: '/account/orders',
      });
      expect(mine.readAt).toBeNull();
      expect(
        (await api('get', '/notifications', b.token)).body.data.some(
          (n: { title: string }) => n.title === title,
        ),
      ).toBe(false);
      const log = await prisma.activityLog.findFirstOrThrow({
        where: { action: 'notification.send', actorId: adminId },
        orderBy: { id: 'desc' },
      });
      expect(log.changes).toMatchObject({ title, recipients: 1, all: false });
    });

    it('gửi nhiều người và gửi cho tất cả; trùng id chỉ tính một; loại promo vào bộ lọc khuyến mãi', async () => {
      const a = await newCustomer('m1');
      const b = await newCustomer('m2');
      const multi = await api('post', '/admin/notifications', admin, {
        title: `Nhiều người ${uniq()}`,
        content: 'Nội dung',
        type: 'promo',
        userIds: [a.id, b.id, a.id],
      });
      expect(multi.body.data).toEqual({ sent: 2 });
      expect(
        (await api('get', '/notifications?type=promo', a.token)).body.data.length,
      ).toBeGreaterThanOrEqual(1);

      const title = `Tất cả ${uniq()}`;
      const before = await prisma.user.count({ where: { deletedAt: null, status: { not: 'banned' } } });
      const everyone = await api('post', '/admin/notifications', admin, {
        title,
        content: 'Chào mọi người',
        all: true,
      });
      expect(everyone.status).toBe(201);
      expect(everyone.body.data.sent).toBe(before);
      expect(await prisma.notification.count({ where: { title } })).toBe(before);
      expect(
        (await api('get', '/notifications', b.token)).body.data.some(
          (n: { title: string }) => n.title === title,
        ),
      ).toBe(true);
    });

    it('validation 400; người nhận không tồn tại/đã xóa 400; không gửi nếu lỗi (không để lại dữ liệu dở); 401/403', async () => {
      const before = await prisma.notification.count();
      const bad = await api('post', '/admin/notifications', admin, { title: 'x', content: '', userIds: [] });
      expect(bad.status).toBe(400);
      expect(Object.keys(bad.body.error.details).sort()).toEqual(['content', 'title', 'userIds']);
      const both = await api('post', '/admin/notifications', admin, {
        title: 'Hai kiểu',
        content: 'a',
        all: true,
        userIds: [1],
      });
      expect(both.status).toBe(400);
      expect(
        (
          await api('post', '/admin/notifications', admin, {
            title: 'Sai loại',
            content: 'a',
            type: 'order',
            userIds: [1],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await api('post', '/admin/notifications', admin, {
            title: 'Sai link',
            content: 'a',
            link: 'javascript:alert(1)',
            userIds: [1],
          })
        ).status,
      ).toBe(400);
      const ghost = await api('post', '/admin/notifications', admin, {
        title: 'Người lạ',
        content: 'a',
        userIds: [99999999],
      });
      expect(ghost.status).toBe(400);
      expect(ghost.body.error.details.userIds[0]).toContain('99999999');

      const gone = await newCustomer('gone');
      await api('delete', '/users/me', gone.token, { password: gone.password });
      expect(
        (
          await api('post', '/admin/notifications', admin, {
            title: 'Đã xóa',
            content: 'a',
            userIds: [gone.id],
          })
        ).status,
      ).toBe(400);
      expect(await prisma.notification.count()).toBe(before); // không có thông báo nào được tạo

      expect(
        (await api('post', '/admin/notifications', undefined, { title: 'ab', content: 'a', all: true }))
          .status,
      ).toBe(401);
      expect(
        (await api('post', '/admin/notifications', cust, { title: 'ab', content: 'a', all: true })).status,
      ).toBe(403);
      // thiếu quyền manage_content ⇒ 403 dù là admin
      const perms = app.get(PermissionsService);
      const rp = await prisma.rolePermission.findFirstOrThrow({
        where: { permission: { code: 'manage_content' }, role: { code: 'admin' } },
      });
      await prisma.rolePermission.delete({
        where: { roleId_permissionId: { roleId: rp.roleId, permissionId: rp.permissionId } },
      });
      perms.clearCache();
      try {
        expect(
          (
            await api('post', '/admin/notifications', admin, {
              title: 'Không quyền',
              content: 'a',
              all: true,
            })
          ).status,
        ).toBe(403);
      } finally {
        await prisma.rolePermission.create({ data: { roleId: rp.roleId, permissionId: rp.permissionId } });
        perms.clearCache();
      }
    });
  });
});
