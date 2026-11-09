// E2E (supertest) trên aurelia_test: UC-ACC-04 sổ địa chỉ, UC-ACC-01 cập nhật hồ sơ, UC-ACC-06 yêu thích, UC-SPACE-04 lưu không gian,
// UC-ADM-24 xác nhận thanh toán chuyển khoản. Mỗi test tự đăng ký khách riêng (đúng luồng thật) nên không phụ thuộc dữ liệu seed.
// Số thứ tự UC theo docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md. Các quyết định của chủ dự án (D-N30, D-N31, D-N33) đã được triển khai và kiểm ở đây.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('Tài khoản, yêu thích, bookmark, xác nhận thanh toán (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let seq = 0;

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const customer = async (label = 'acc') => {
    const email = `${label}-${Date.now()}-${++seq}@test.local`;
    const password = 'matkhau-12345';
    const reg = await api('post', '/auth/register', undefined, {
      fullName: `Khách ${label}`,
      email,
      phone: '0911222333',
      password,
    });
    expect(reg.status).toBe(201);
    const login = await api('post', '/auth/login', undefined, { email, password });
    expect(login.status).toBe(200);
    const u = await prisma.user.findFirstOrThrow({ where: { email } });
    return { id: u.id, email, token: login.body.data.tokens.accessToken as string };
  };
  const addrBody = (over: Record<string, unknown> = {}) => ({
    recipientName: 'Nguyễn Văn A',
    phone: '0912345678',
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Phường Bến Nghé',
    addressLine: '12 Lê Lợi',
    ...over,
  });

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await api('post', '/auth/login', undefined, {
      email: 'admin@aurelia.vn',
      password: 'admin123',
      adminOnly: true,
    });
    admin = r.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  // ------------------------------------------------------------------ UC-ACC-04 sổ địa chỉ
  describe('UC-ACC-04 sổ địa chỉ giao hàng', () => {
    const defaults = (userId: number) => prisma.address.count({ where: { userId, isDefault: true } });

    it('chưa đăng nhập ⇒ 401 ở mọi thao tác', async () => {
      for (const [m, p] of [
        ['get', '/addresses'],
        ['post', '/addresses'],
        ['patch', '/addresses/1'],
        ['patch', '/addresses/1/default'],
        ['delete', '/addresses/1'],
      ] as const)
        expect((await api(m, p, undefined, m === 'post' ? addrBody() : undefined)).status).toBe(401);
    });

    it('thêm: địa chỉ đầu tiên tự là mặc định; sau đó mặc định chỉ đổi khi yêu cầu; luôn đúng một mặc định', async () => {
      const u = await customer('addr');
      expect((await api('get', '/addresses', u.token)).body.data).toEqual([]);

      const a = await api(
        'post',
        '/addresses',
        u.token,
        addrBody({ isDefault: false, recipientName: '  Lê Thị B  ' }),
      );
      expect(a.status).toBe(201);
      expect(a.body.data).toMatchObject({
        recipientName: 'Lê Thị B',
        isDefault: true,
        label: 'Địa chỉ khác',
      }); // đầu tiên ⇒ mặc định; tên được cắt khoảng trắng
      const b = await api('post', '/addresses', u.token, addrBody({ label: 'Văn phòng' }));
      expect(b.body.data).toMatchObject({ isDefault: false, label: 'Văn phòng' });
      const c = await api(
        'post',
        '/addresses',
        u.token,
        addrBody({ isDefault: true, addressLine: '99 Hai Bà Trưng' }),
      );
      expect(c.body.data.isDefault).toBe(true);
      expect(await defaults(u.id)).toBe(1);
      const list = (await api('get', '/addresses', u.token)).body.data as Array<{
        id: number;
        isDefault: boolean;
      }>;
      expect(list).toHaveLength(3);
      expect(list[0].id).toBe(c.body.data.id); // mặc định đứng đầu
      expect(list.filter((x) => x.isDefault)).toHaveLength(1);
    });

    it('dữ liệu vào không hợp lệ ⇒ 400 kèm lỗi theo trường; không ghi gì', async () => {
      const u = await customer('addr-bad');
      const bad = async (over: Record<string, unknown>, field: string) => {
        const r = await api('post', '/addresses', u.token, addrBody(over));
        expect(r.status).toBe(400);
        expect(r.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(r.body.error.details)).toContain(field);
      };
      await bad({ recipientName: 'A' }, 'recipientName');
      await bad({ recipientName: '   ' }, 'recipientName');
      await bad({ phone: '12345' }, 'phone');
      await bad({ phone: 'abcdefghij' }, 'phone');
      await bad({ phone: '09123456789' }, 'phone'); // chỉ nhận đúng 10 chữ số, bắt đầu bằng 0 (quyết định 2026-11-09)
      await bad({ province: '' }, 'province');
      await bad({ district: '  ' }, 'district');
      await bad({ ward: undefined }, 'ward');
      await bad({ addressLine: '' }, 'addressLine');
      const empty = await api('post', '/addresses', u.token, {});
      expect(empty.status).toBe(400);
      expect(Object.keys(empty.body.error.details).sort()).toEqual([
        'addressLine',
        'district',
        'phone',
        'province',
        'recipientName',
        'ward',
      ]);
      expect(await prisma.address.count({ where: { userId: u.id } })).toBe(0);
    });

    it('sửa: đổi từng phần, giữ trường còn lại; sai dữ liệu ⇒ 400; đặt mặc định qua sửa; id không tồn tại/của người khác ⇒ 404', async () => {
      const u = await customer('addr-upd');
      const other = await customer('addr-other');
      const a = (await api('post', '/addresses', u.token, addrBody())).body.data;
      const b = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'B' }))).body.data;
      const foreign = (await api('post', '/addresses', other.token, addrBody())).body.data;

      const upd = await api('patch', `/addresses/${b.id}`, u.token, {
        recipientName: 'Người Mới',
        label: 'Nhà riêng',
      });
      expect(upd.status).toBe(200);
      expect(upd.body.data).toMatchObject({
        id: b.id,
        recipientName: 'Người Mới',
        label: 'Nhà riêng',
        phone: b.phone,
        province: b.province,
        addressLine: 'B',
        isDefault: false,
      });
      expect((await api('patch', `/addresses/${b.id}`, u.token, { phone: '123' })).status).toBe(400);
      expect((await api('patch', `/addresses/${b.id}`, u.token, { addressLine: '' })).status).toBe(400);
      expect((await prisma.address.findUniqueOrThrow({ where: { id: b.id } })).phone).toBe(b.phone); // lỗi ⇒ không đổi

      const makeDefault = await api('patch', `/addresses/${b.id}`, u.token, { isDefault: true });
      expect(makeDefault.body.data.isDefault).toBe(true);
      expect((await prisma.address.findUniqueOrThrow({ where: { id: a.id } })).isDefault).toBe(false);
      expect(await defaults(u.id)).toBe(1);

      expect(
        (await api('patch', `/addresses/${foreign.id}`, u.token, { recipientName: 'Kẻ lạ' })).status,
      ).toBe(404);
      expect((await prisma.address.findUniqueOrThrow({ where: { id: foreign.id } })).recipientName).toBe(
        foreign.recipientName,
      );
      expect((await api('patch', '/addresses/999999999', u.token, { recipientName: 'Xx' })).status).toBe(404);
      expect((await api('patch', '/addresses/abc', u.token, { recipientName: 'Xx' })).status).toBe(400);
      function defaults(userId: number) {
        return prisma.address.count({ where: { userId, isDefault: true } });
      }
    });

    it('đặt mặc định: chuyển cờ trong một thao tác, luôn đúng một mặc định; địa chỉ của người khác/không có ⇒ 404 và không đổi gì', async () => {
      const u = await customer('addr-def');
      const other = await customer('addr-def-o');
      const a = (await api('post', '/addresses', u.token, addrBody())).body.data;
      const b = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'B' }))).body.data;
      const c = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'C' }))).body.data;
      const foreign = (await api('post', '/addresses', other.token, addrBody())).body.data;
      expect(a.isDefault).toBe(true);
      const r = await api('patch', `/addresses/${c.id}/default`, u.token);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ id: c.id, isDefault: true });
      const rows = await prisma.address.findMany({ where: { userId: u.id }, orderBy: { id: 'asc' } });
      expect(rows.map((x) => x.isDefault)).toEqual([false, false, true]);
      expect((await api('patch', `/addresses/${b.id}/default`, u.token)).status).toBe(200);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);

      expect((await api('patch', `/addresses/${foreign.id}/default`, u.token)).status).toBe(404);
      expect((await api('patch', '/addresses/999999999/default', u.token)).status).toBe(404);
      expect((await api('patch', '/addresses/abc/default', u.token)).status).toBe(400);
      // người kia không bị ảnh hưởng
      expect((await prisma.address.findUniqueOrThrow({ where: { id: foreign.id } })).isDefault).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);
    });

    it('xóa: địa chỉ thường; xóa mặc định ⇒ một địa chỉ còn lại thành mặc định; xóa được cả địa chỉ cuối cùng; của người khác/không có ⇒ 404', async () => {
      const u = await customer('addr-del');
      const other = await customer('addr-del-o');
      const a = (await api('post', '/addresses', u.token, addrBody())).body.data;
      const b = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'B' }))).body.data;
      const c = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'C' }))).body.data;
      const foreign = (await api('post', '/addresses', other.token, addrBody())).body.data;

      expect((await api('delete', `/addresses/${foreign.id}`, u.token)).status).toBe(404);
      expect(await prisma.address.count({ where: { id: foreign.id } })).toBe(1);
      expect((await api('delete', '/addresses/999999999', u.token)).status).toBe(404);
      expect((await api('delete', '/addresses/abc', u.token)).status).toBe(400);

      // xóa địa chỉ thường: mặc định giữ nguyên
      expect((await api('delete', `/addresses/${c.id}`, u.token)).status).toBe(200);
      expect(await prisma.address.count({ where: { id: c.id } })).toBe(0);
      expect((await prisma.address.findUniqueOrThrow({ where: { id: a.id } })).isDefault).toBe(true);

      // xóa địa chỉ mặc định khi còn địa chỉ khác ⇒ địa chỉ còn lại được đặt làm mặc định
      expect((await api('delete', `/addresses/${a.id}`, u.token)).status).toBe(200);
      expect((await prisma.address.findUniqueOrThrow({ where: { id: b.id } })).isDefault).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);

      // địa chỉ cuối cùng XÓA ĐƯỢC (quyết định 2026-11-09): sổ địa chỉ rỗng là hợp lệ
      const last = await api('delete', `/addresses/${b.id}`, u.token);
      expect(last.status).toBe(200);
      expect(await prisma.address.count({ where: { userId: u.id } })).toBe(0);
      const empty = await api('get', '/addresses', u.token);
      expect(empty.status).toBe(200);
      expect(empty.body.data).toEqual([]);
    });

    it('xóa địa chỉ mặc định ⇒ địa chỉ MỚI NHẤT còn lại (id lớn nhất) thành mặc định, không phải địa chỉ cũ nhất', async () => {
      const u = await customer('addr-newest');
      const a = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'A cũ nhất' }))).body.data;
      const b = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'B' }))).body.data;
      const c = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'C' }))).body.data;
      const d = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'D mới nhất' }))).body.data;
      expect(a.isDefault).toBe(true);
      expect([b.isDefault, c.isDefault, d.isDefault]).toEqual([false, false, false]);
      expect((await api('delete', `/addresses/${a.id}`, u.token)).status).toBe(200);
      const rows = await prisma.address.findMany({ where: { userId: u.id }, orderBy: { id: 'asc' } });
      expect(rows.map((r) => r.isDefault)).toEqual([false, false, true]);
      expect(rows[2].id).toBe(d.id);
      // xóa tiếp mặc định mới ⇒ lại chọn mới nhất trong số còn lại (c)
      expect((await api('delete', `/addresses/${d.id}`, u.token)).status).toBe(200);
      expect((await prisma.address.findUniqueOrThrow({ where: { id: c.id } })).isDefault).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);
    });

    it('xóa hết địa chỉ rồi thêm lại: địa chỉ đầu tiên mới tự là mặc định; trạng thái tài khoản vẫn hợp lệ; số 11 chữ số vẫn bị từ chối', async () => {
      const u = await customer('addr-reset');
      const a = (await api('post', '/addresses', u.token, addrBody())).body.data;
      expect((await api('delete', `/addresses/${a.id}`, u.token)).status).toBe(200);
      expect((await api('get', '/users/me', u.token)).status).toBe(200); // tài khoản không bị ảnh hưởng
      const again = await api('post', '/addresses', u.token, addrBody({ addressLine: 'Mới sau khi rỗng' }));
      expect(again.status).toBe(201);
      expect(again.body.data.isDefault).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);
      expect((await api('post', '/addresses', u.token, addrBody({ phone: '09123456789' }))).status).toBe(400);
    });

    it('đặt hàng khi KHÔNG có địa chỉ ⇒ 400 lỗi theo trường addressId (không phải lỗi hệ thống), không tạo đơn', async () => {
      const u = await customer('addr-nocheckout');
      const before = await prisma.order.count({ where: { userId: u.id } });
      const r = await api('post', '/orders', u.token, { paymentMethod: 'cod' });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(r.body.error.details ?? r.body.error)).toContain('addressId');
      expect(await prisma.order.count({ where: { userId: u.id } })).toBe(before);
      // cũng sai khi dùng địa chỉ của người khác
      const other = await customer('addr-nocheckout-o');
      const foreign = (await api('post', '/addresses', other.token, addrBody())).body.data;
      const r2 = await api('post', '/orders', u.token, { addressId: foreign.id, paymentMethod: 'cod' });
      expect(r2.status).toBe(400);
    });

    it('đồng thời: nhiều thao tác địa chỉ chạy song song vẫn luôn còn đúng một mặc định và không lỗi 5xx', async () => {
      const u = await customer('addr-race');
      const seed = (await api('post', '/addresses', u.token, addrBody({ addressLine: 'gốc' }))).body.data;
      // 1. 12 yêu cầu tạo địa chỉ mặc định cùng lúc
      const created = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          api('post', '/addresses', u.token, addrBody({ addressLine: `song song ${i}`, isDefault: true })),
        ),
      );
      expect(created.every((r) => r.status === 201)).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id } })).toBe(13);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);

      // 2. đặt mặc định và xóa song song trên nhiều địa chỉ
      const ids = created.map((r) => r.body.data.id as number);
      const mixed = await Promise.all([
        ...ids.slice(0, 4).map((id) => api('patch', `/addresses/${id}/default`, u.token)),
        ...ids.slice(4, 8).map((id) => api('delete', `/addresses/${id}`, u.token)),
        api('delete', `/addresses/${seed.id}`, u.token),
      ]);
      expect(mixed.every((r) => r.status < 500)).toBe(true);
      expect(mixed.every((r) => [200, 201, 404].includes(r.status))).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id, isDefault: true } })).toBe(1);

      // 3. xóa song song toàn bộ: kết thúc rỗng, không lỗi 5xx, không còn mặc định mồ côi
      const left = await prisma.address.findMany({ where: { userId: u.id } });
      const dels = await Promise.all(left.map((a) => api('delete', `/addresses/${a.id}`, u.token)));
      expect(dels.every((r) => r.status === 200)).toBe(true);
      expect(await prisma.address.count({ where: { userId: u.id } })).toBe(0);
    });

    it('mỗi người chỉ thấy địa chỉ của mình; sửa/xóa địa chỉ không ảnh hưởng đơn đã đặt (đơn lưu bản chụp)', async () => {
      const u = await customer('addr-snap');
      const other = await customer('addr-snap-o');
      await api('post', '/addresses', other.token, addrBody({ recipientName: 'Người Khác' }));
      const a = (await api('post', '/addresses', u.token, addrBody({ recipientName: 'Người Nhận Gốc' }))).body
        .data;
      await api('post', '/addresses', u.token, addrBody({ addressLine: 'Dự phòng' }));
      const mine = (await api('get', '/addresses', u.token)).body.data as Array<{ userId: number }>;
      expect(mine.every((x) => x.userId === u.id)).toBe(true);
      expect(mine).toHaveLength(2);

      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gt: 5 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
      });
      expect((await api('post', '/cart/items', u.token, { variantId: v.id, quantity: 1 })).status).toBe(201);
      const o = await api('post', '/orders', u.token, { addressId: a.id, paymentMethod: 'cod' });
      expect(o.status).toBe(201);
      const before = (await api('get', `/orders/${o.body.data.orderCode}`, u.token)).body.data;
      expect(JSON.stringify(before)).toContain('Người Nhận Gốc');

      expect(
        (
          await api('patch', `/addresses/${a.id}`, u.token, {
            recipientName: 'Đã Đổi Tên',
            addressLine: 'Số mới',
          })
        ).status,
      ).toBe(200);
      expect((await api('delete', `/addresses/${a.id}`, u.token)).status).toBe(200);
      const after = (await api('get', `/orders/${o.body.data.orderCode}`, u.token)).body.data;
      expect(after).toEqual(before); // đơn không đổi
      expect(JSON.stringify(after)).not.toContain('Đã Đổi Tên');
    });
  });

  // ------------------------------------------------------------------ UC-ACC-01 cập nhật hồ sơ
  describe('UC-ACC-01 xem và cập nhật hồ sơ', () => {
    it('401 khi chưa đăng nhập; xem hồ sơ trả đúng thông tin của mình, không lộ mật khẩu', async () => {
      expect((await api('get', '/users/me')).status).toBe(401);
      expect((await api('patch', '/users/me', undefined, { fullName: 'Xx' })).status).toBe(401);
      const u = await customer('prof');
      const me = await api('get', '/users/me', u.token);
      expect(me.status).toBe(200);
      expect(me.body.data).toMatchObject({ email: u.email, fullName: 'Khách prof' });
      expect(JSON.stringify(me.body.data)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
    });

    it('cập nhật tên, điện thoại, giới tính, ngày sinh; chỉ đổi trường được gửi; lưu thật vào CSDL', async () => {
      const u = await customer('prof-upd');
      const r = await api('patch', '/users/me', u.token, {
        fullName: '  Trần Thị Mai  ',
        phone: '0987654321',
        gender: 'female',
        birthday: '1995-07-21',
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        fullName: 'Trần Thị Mai',
        phone: '0987654321',
        gender: 'female',
        birthday: '1995-07-21',
      });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row).toMatchObject({ fullName: 'Trần Thị Mai', phone: '0987654321', gender: 'female' });
      expect(row.birthday?.toISOString().slice(0, 10)).toBe('1995-07-21');
      // chỉ gửi một trường ⇒ các trường khác giữ nguyên
      const only = await api('patch', '/users/me', u.token, { fullName: 'Tên Khác' });
      expect(only.body.data).toMatchObject({
        fullName: 'Tên Khác',
        phone: '0987654321',
        gender: 'female',
        birthday: '1995-07-21',
      });
      // xóa điện thoại/ngày sinh bằng chuỗi rỗng
      const cleared = await api('patch', '/users/me', u.token, { phone: '', birthday: '', gender: '' });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.phone).toBeNull();
      expect(cleared.body.data.birthday).toBeNull();
      expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).phone).toBeNull();
    });

    it('dữ liệu sai ⇒ 400 theo trường và không đổi gì; email, vai trò, trạng thái không thể đổi qua hồ sơ', async () => {
      const u = await customer('prof-bad');
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: u.id },
        include: { userRoles: true },
      });
      for (const [body, field] of [
        [{ fullName: 'A' }, 'fullName'],
        [{ fullName: '   ' }, 'fullName'],
        [{ phone: '123' }, 'phone'],
        [{ phone: '09123456789' }, 'phone'],
        [{ phone: 'abcdefghij' }, 'phone'],
      ] as const) {
        const r = await api('patch', '/users/me', u.token, body);
        expect(r.status).toBe(400);
        expect(Object.keys(r.body.error.details)).toContain(field);
      }
      const hack = await api('patch', '/users/me', u.token, {
        email: 'hacker@evil.test',
        status: 'suspended',
        roles: ['admin'],
        id: 1,
        fullName: 'Vẫn Hợp Lệ',
      });
      expect(hack.status).toBe(200);
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: u.id },
        include: { userRoles: true },
      });
      expect(after.email).toBe(before.email);
      expect(after.status).toBe(before.status);
      expect(after.userRoles.map((r) => r.roleId)).toEqual(before.userRoles.map((r) => r.roleId));
      expect(after.fullName).toBe('Vẫn Hợp Lệ');
      // vẫn không vào được khu quản trị
      expect((await api('get', '/admin/orders', u.token)).status).toBe(403);
    });

    it('ngày sinh không hợp lệ không làm máy chủ lỗi 5xx', async () => {
      const u = await customer('prof-bday');
      const r = await api('patch', '/users/me', u.token, { birthday: 'không-phải-ngày' });
      expect(r.status).toBeLessThan(500);
    });
  });

  // ------------------------------------------------------------------ UC-ACC-06 yêu thích
  describe('UC-ACC-06 danh sách yêu thích', () => {
    it('401 khi chưa đăng nhập ở cả ba thao tác', async () => {
      expect((await api('get', '/wishlist')).status).toBe(401);
      expect((await api('put', '/wishlist/sofa-nordic')).status).toBe(401);
      expect((await api('delete', '/wishlist/sofa-nordic')).status).toBe(401);
    });

    it('thêm (lặp lại không tạo bản trùng), liệt kê mới nhất trước, bỏ thích; slug lạ ⇒ 404; sản phẩm ẩn không thêm được', async () => {
      const u = await customer('wish');
      const [p1, p2] = await prisma.product.findMany({
        where: { status: 'published', deletedAt: null },
        orderBy: { id: 'asc' },
        take: 2,
      });
      expect((await api('get', '/wishlist', u.token)).body.data).toEqual([]);
      expect((await api('put', `/wishlist/${p1.slug}`, u.token)).status).toBe(200);
      expect((await api('put', `/wishlist/${p1.slug}`, u.token)).status).toBe(200); // lặp lại
      expect((await api('put', `/wishlist/${p2.slug}`, u.token)).status).toBe(200);
      expect(await prisma.wishlist.count({ where: { userId: u.id } })).toBe(2);
      const list = (await api('get', '/wishlist', u.token)).body.data as Array<{
        slug: string;
        isWishlisted: boolean;
      }>;
      expect(list.map((x) => x.slug)).toEqual([p2.slug, p1.slug]);
      expect(list.every((x) => x.isWishlisted)).toBe(true);

      expect((await api('put', '/wishlist/khong-co-san-pham-nay', u.token)).status).toBe(404);
      expect(await prisma.wishlist.count({ where: { userId: u.id } })).toBe(2);

      expect((await api('delete', `/wishlist/${p1.slug}`, u.token)).status).toBe(200);
      expect(await prisma.wishlist.count({ where: { userId: u.id, productId: p1.id } })).toBe(0);
      expect((await api('delete', `/wishlist/${p1.slug}`, u.token)).status).toBe(200); // bỏ lần nữa: không lỗi
      expect((await api('delete', '/wishlist/khong-co-san-pham-nay', u.token)).status).toBe(200);
      expect(
        ((await api('get', '/wishlist', u.token)).body.data as Array<{ slug: string }>).map((x) => x.slug),
      ).toEqual([p2.slug]);
    });

    it('mỗi người một danh sách riêng; chi tiết sản phẩm phản ánh isWishlisted của người đang xem', async () => {
      const a = await customer('wish-a');
      const b = await customer('wish-b');
      const p = await prisma.product.findFirstOrThrow({
        where: { status: 'published', deletedAt: null },
        orderBy: { id: 'desc' },
      });
      await api('put', `/wishlist/${p.slug}`, a.token);
      expect((await api('get', '/wishlist', b.token)).body.data).toEqual([]);
      expect((await api('get', `/products/${p.slug}`, a.token)).body.data.isWishlisted).toBe(true);
      expect((await api('get', `/products/${p.slug}`, b.token)).body.data.isWishlisted).toBe(false);
      expect((await api('get', `/products/${p.slug}`)).body.data.isWishlisted).toBe(false);
      await api('delete', `/wishlist/${p.slug}`, b.token); // b bỏ thích: không ảnh hưởng a
      expect(await prisma.wishlist.count({ where: { userId: a.id, productId: p.id } })).toBe(1);
    });
  });

  // ------------------------------------------------------------------ UC-SPACE-04 lưu không gian
  describe('UC-SPACE-04 lưu / bỏ lưu không gian mẫu', () => {
    it('cần đăng nhập; lưu (lặp lại không trùng), hiện ở danh sách bookmarked và isBookmarked, bỏ lưu; không gian lạ ⇒ 404', async () => {
      const sp = await prisma.space.findFirstOrThrow({
        where: { status: 'published' },
        orderBy: { id: 'asc' },
      });
      expect((await api('put', `/spaces/${sp.slug}/bookmark`)).status).toBe(401);
      expect((await api('delete', `/spaces/${sp.slug}/bookmark`)).status).toBe(401);

      const u = await customer('bm');
      const other = await customer('bm-o');
      expect((await api('put', `/spaces/${sp.slug}/bookmark`, u.token)).status).toBe(200);
      expect((await api('put', `/spaces/${sp.slug}/bookmark`, u.token)).status).toBe(200); // lặp lại
      expect(await prisma.spaceBookmark.count({ where: { userId: u.id, spaceId: sp.id } })).toBe(1);

      const bm = await api('get', '/spaces?bookmarked=true&pageSize=50', u.token);
      expect((bm.body.data as Array<{ slug: string }>).map((s) => s.slug)).toEqual([sp.slug]);
      expect(bm.body.data[0].isBookmarked).toBe(true);
      expect((await api('get', `/spaces/${sp.slug}`, u.token)).body.data.isBookmarked).toBe(true);
      // người khác và khách ẩn danh không thấy
      expect((await api('get', `/spaces/${sp.slug}`, other.token)).body.data.isBookmarked).toBe(false);
      expect((await api('get', `/spaces/${sp.slug}`)).body.data.isBookmarked).toBe(false);
      expect((await api('get', '/spaces?bookmarked=true', other.token)).body.data).toEqual([]);

      expect((await api('put', '/spaces/khong-co-khong-gian/bookmark', u.token)).status).toBe(404);

      expect((await api('delete', `/spaces/${sp.slug}/bookmark`, u.token)).status).toBe(200);
      expect(await prisma.spaceBookmark.count({ where: { userId: u.id } })).toBe(0);
      expect((await api('delete', `/spaces/${sp.slug}/bookmark`, u.token)).status).toBe(200); // bỏ lần nữa: không lỗi
      expect((await api('get', '/spaces?bookmarked=true', u.token)).body.data).toEqual([]);
    });

    it('không gian chưa đăng (draft/archived) ⇒ 404 khi lưu và không tạo bookmark; không gian đã lưu rồi bị ẩn thì biến mất khỏi danh sách nhưng vẫn bỏ lưu được', async () => {
      const u = await customer('bm-draft');
      const pub = await prisma.space.findFirstOrThrow({
        where: { status: 'published' },
        orderBy: { id: 'asc' },
      });
      const copy = await prisma.space.create({
        data: {
          title: 'Không gian nháp thử bookmark',
          slug: `nhap-bm-${Date.now()}`,
          roomType: pub.roomType,
          status: 'draft',
        },
      });
      try {
        const r = await api('put', `/spaces/${copy.slug}/bookmark`, u.token);
        expect(r.status).toBe(404);
        expect(await prisma.spaceBookmark.count({ where: { spaceId: copy.id } })).toBe(0);

        // đã lưu khi đang đăng, sau đó bị ẩn
        await prisma.space.update({
          where: { id: copy.id },
          data: { status: 'published', publishedAt: new Date() },
        });
        expect((await api('put', `/spaces/${copy.slug}/bookmark`, u.token)).status).toBe(200);
        expect(
          (
            (await api('get', '/spaces?bookmarked=true&pageSize=50', u.token)).body.data as Array<{
              slug: string;
            }>
          ).map((x) => x.slug),
        ).toContain(copy.slug);
        await prisma.space.update({ where: { id: copy.id }, data: { status: 'archived' } });
        expect(
          (
            (await api('get', '/spaces?bookmarked=true&pageSize=50', u.token)).body.data as Array<{
              slug: string;
            }>
          ).map((x) => x.slug),
        ).not.toContain(copy.slug);
        expect((await api('put', `/spaces/${copy.slug}/bookmark`, u.token)).status).toBe(404);
        // bỏ lưu một không gian đã ẩn vẫn thành công và xóa bản ghi
        expect((await api('delete', `/spaces/${copy.slug}/bookmark`, u.token)).status).toBe(200);
        expect(await prisma.spaceBookmark.count({ where: { userId: u.id, spaceId: copy.id } })).toBe(0);
      } finally {
        await prisma.spaceBookmark.deleteMany({ where: { spaceId: copy.id } });
        await prisma.space.delete({ where: { id: copy.id } });
      }
    });

    it('danh sách đã lưu: khách ẩn danh nhận danh sách rỗng (không lộ dữ liệu người khác), có phân trang, mỗi người một danh sách', async () => {
      const u = await customer('bm-list');
      const other = await customer('bm-list-o');
      const spaces = await prisma.space.findMany({
        where: { status: 'published' },
        orderBy: { id: 'asc' },
        take: 3,
      });
      expect(spaces.length).toBeGreaterThanOrEqual(3);
      for (const sp of spaces)
        expect((await api('put', `/spaces/${sp.slug}/bookmark`, u.token)).status).toBe(200);

      const anon = await api('get', '/spaces?bookmarked=true');
      expect(anon.status).toBe(200);
      expect(anon.body.data).toEqual([]);
      expect(anon.body.meta.total).toBe(0);
      expect((await api('get', '/spaces?bookmarked=true', other.token)).body.meta.total).toBe(0);

      const p1 = await api('get', '/spaces?bookmarked=true&pageSize=2&page=1', u.token);
      const p2 = await api('get', '/spaces?bookmarked=true&pageSize=2&page=2', u.token);
      expect(p1.body.meta).toMatchObject({ total: 3, totalPages: 2, pageSize: 2, page: 1 });
      expect(p1.body.data).toHaveLength(2);
      expect(p2.body.data).toHaveLength(1);
      const got = [...p1.body.data, ...p2.body.data].map((x: { slug: string }) => x.slug).sort();
      expect(got).toEqual(spaces.map((x) => x.slug).sort());
      expect((p1.body.data as Array<{ isBookmarked: boolean }>).every((x) => x.isBookmarked)).toBe(true);
    });
  });

  // ------------------------------------------------------------------ UC-ADM-24 xác nhận thanh toán
  describe('UC-ADM-24 xác nhận thanh toán chuyển khoản', () => {
    const bankOrder = async () => {
      const u = await customer('pay');
      const a = (await api('post', '/addresses', u.token, addrBody())).body.data;
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gt: 5 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
      });
      await api('post', '/cart/items', u.token, { variantId: v.id, quantity: 1 });
      const o = await api('post', '/orders', u.token, { addressId: a.id, paymentMethod: 'bank_transfer' });
      expect(o.status).toBe(201);
      return { u, order: o.body.data as { id: number; orderCode: string; payment: { id: number } } };
    };

    it('đơn pending: xác nhận ⇒ payment success + paidAt, đơn paid và confirmed, thông báo cho khách, ghi nhật ký; xác nhận lại ⇒ 409', async () => {
      const { u, order } = await bankOrder();
      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect([before.status, before.paymentStatus]).toEqual(['pending', 'unpaid']);
      const r = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        orderCode: order.orderCode,
        paymentStatus: 'paid',
        status: 'confirmed',
      });
      const pay = await prisma.payment.findUniqueOrThrow({ where: { id: order.payment.id } });
      expect(pay.status).toBe('success');
      expect(pay.paidAt).not.toBeNull();
      const note = await prisma.notification.findFirst({
        where: { userId: u.id, title: `Thanh toán đơn ${order.orderCode} đã được xác nhận` },
      });
      expect(note).not.toBeNull();
      expect(
        await prisma.activityLog.count({ where: { action: 'order.confirm_payment', targetId: order.id } }),
      ).toBe(1);

      const again = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVALID_STATE');
      expect(
        await prisma.activityLog.count({ where: { action: 'order.confirm_payment', targetId: order.id } }),
      ).toBe(1); // không ghi thêm
      expect(
        await prisma.notification.count({
          where: { userId: u.id, title: `Thanh toán đơn ${order.orderCode} đã được xác nhận` },
        }),
      ).toBe(1);
    });

    it('giao dịch không tồn tại ⇒ 404; id sai kiểu ⇒ 400; chưa đăng nhập ⇒ 401; khách hàng ⇒ 403 và không đổi gì', async () => {
      const { u, order } = await bankOrder();
      const nf = await api('patch', '/admin/payments/999999999/confirm', admin);
      expect(nf.status).toBe(404);
      expect(nf.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect((await api('patch', '/admin/payments/abc/confirm', admin)).status).toBe(400);
      expect((await api('patch', `/admin/payments/${order.payment.id}/confirm`)).status).toBe(401);
      expect((await api('patch', `/admin/payments/${order.payment.id}/confirm`, u.token)).status).toBe(403);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect([row.status, row.paymentStatus]).toEqual(['pending', 'unpaid']);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: order.payment.id } })).status).not.toBe(
        'success',
      );
    });

    it('đơn đã sang processing: xác nhận chỉ đổi trạng thái thanh toán, giữ nguyên trạng thái đơn', async () => {
      const { order } = await bankOrder();
      for (const st of ['confirmed', 'processing'])
        expect((await api('patch', `/admin/orders/${order.id}/status`, admin, { status: st })).status).toBe(
          200,
        );
      const r = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ paymentStatus: 'paid', status: 'processing' });
    });

    const tx = (label: string) => `TXN-${label}-${Date.now()}-${++seq}`;
    const payRow = (id: number) => prisma.payment.findUniqueOrThrow({ where: { id } });
    const ordRow = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });

    it('xác nhận kèm transactionCode: lưu mã giao dịch, thông tin đối soát (người xác nhận, thời điểm) và nhật ký', async () => {
      const { order } = await bankOrder();
      const code = tx('ok');
      const r = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin, {
        transactionCode: `  ${code}  `,
      });
      expect(r.status).toBe(200);
      const p = await payRow(order.payment.id);
      expect(p.status).toBe('success');
      expect(p.transactionCode).toBe(code); // đã cắt khoảng trắng
      expect(p.paidAt).not.toBeNull();
      expect(p.gatewayResponse).toMatchObject({ manual: true, action: 'confirm' });
      expect((p.gatewayResponse as { confirmedBy: number }).confirmedBy).toBeGreaterThan(0);
      const log = await prisma.activityLog.findFirstOrThrow({
        where: { action: 'order.confirm_payment', targetId: order.id },
      });
      expect(JSON.stringify(log.changes)).toContain(code);
      // transactionCode quá dài ⇒ 400, không đổi gì
      const { order: o2 } = await bankOrder();
      const long = await api('patch', `/admin/payments/${o2.payment.id}/confirm`, admin, {
        transactionCode: 'x'.repeat(101),
      });
      expect(long.status).toBe(400);
      expect((await payRow(o2.payment.id)).status).toBe('pending');
    });

    it('transactionCode trùng với giao dịch khác ⇒ 409 (kiểm ở mã và ở CSDL); giao dịch vẫn pending, đơn không đổi', async () => {
      const a = await bankOrder();
      const b = await bankOrder();
      const code = tx('dup');
      expect(
        (
          await api('patch', `/admin/payments/${a.order.payment.id}/confirm`, admin, {
            transactionCode: code,
          })
        ).status,
      ).toBe(200);
      const dup = await api('patch', `/admin/payments/${b.order.payment.id}/confirm`, admin, {
        transactionCode: code,
      });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('CONFLICT');
      expect(dup.body.error.details.fields).toContain('transactionCode');
      expect((await payRow(b.order.payment.id)).status).toBe('pending');
      expect((await ordRow(b.order.id)).paymentStatus).toBe('unpaid');
      // ràng buộc UNIQUE ở CSDL (không chỉ ở mã): ghi thẳng cũng bị từ chối
      await expect(
        prisma.payment.update({ where: { id: b.order.payment.id }, data: { transactionCode: code } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      // cùng giao dịch xác nhận lại với mã của chính nó vẫn là 409 (đã thanh toán), không phải lỗi mã trùng
      expect(
        (
          await api('patch', `/admin/payments/${a.order.payment.id}/confirm`, admin, {
            transactionCode: code,
          })
        ).status,
      ).toBe(409);
    });

    it('đơn đã HỦY: vẫn xác nhận được để hoàn tiền (D-N28): giao dịch success, đơn giữ cancelled và paid, sau đó hoàn tiền được', async () => {
      const { order } = await bankOrder();
      expect(
        (await api('post', `/admin/orders/${order.id}/cancel`, admin, { reason: 'khách đổi ý' })).status,
      ).toBe(200);
      expect((await ordRow(order.id)).status).toBe('cancelled');
      const r = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin, {
        transactionCode: tx('cancelled'),
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'paid' });
      expect((await payRow(order.payment.id)).status).toBe('success');
      const refund = await api('post', `/admin/orders/${order.id}/refund`, admin);
      expect(refund.status).toBe(200);
      expect((await ordRow(order.id)).paymentStatus).toBe('refunded');
    });

    it('chỉ chuyển khoản mới xác nhận tay: giao dịch online (cổng quản lý) và COD ⇒ 409, không đổi gì', async () => {
      for (const method of ['vnpay', 'momo', 'zalopay', 'card', 'cod'] as const) {
        const { order } = await bankOrder();
        await prisma.payment.update({ where: { id: order.payment.id }, data: { method } });
        const r = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin, {
          transactionCode: tx(method),
        });
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe('INVALID_STATE');
        expect(r.body.error.message).toMatch(method === 'cod' ? /COD/ : /cổng thanh toán/);
        const f = await api('patch', `/admin/payments/${order.payment.id}/fail`, admin, { reason: 'x' });
        expect(f.status).toBe(409);
        const p = await payRow(order.payment.id);
        expect([p.status, p.transactionCode, p.paidAt]).toEqual(['pending', null, null]);
        expect((await ordRow(order.id)).paymentStatus).toBe('unpaid');
      }
    });

    it('chỉ giao dịch đang chờ: failed / success / refunded không bị ghi đè thành paid', async () => {
      for (const status of ['failed', 'success', 'refunded'] as const) {
        const { order } = await bankOrder();
        await prisma.payment.update({ where: { id: order.payment.id }, data: { status } });
        const r = await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin, {
          transactionCode: tx(status),
        });
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe('INVALID_STATE');
        const p = await payRow(order.payment.id);
        expect(p.status).toBe(status);
        expect(p.transactionCode).toBeNull();
        expect((await ordRow(order.id)).paymentStatus).toBe('unpaid');
      }
    });

    it('đánh dấu thất bại: giao dịch failed, đơn paymentStatus=failed (trạng thái đơn giữ nguyên), thông báo + nhật ký; không làm lại được', async () => {
      const { u, order } = await bankOrder();
      const r = await api('patch', `/admin/payments/${order.payment.id}/fail`, admin, {
        reason: 'Không thấy tiền về tài khoản',
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ paymentStatus: 'failed', status: 'pending' });
      const p = await payRow(order.payment.id);
      expect(p.status).toBe('failed');
      expect(p.paidAt).toBeNull();
      expect(p.gatewayResponse).toMatchObject({
        manual: true,
        action: 'fail',
        reason: 'Không thấy tiền về tài khoản',
      });
      const note = await prisma.notification.findFirstOrThrow({
        where: { userId: u.id, title: `Thanh toán đơn ${order.orderCode} chưa được xác nhận` },
      });
      expect(JSON.stringify(note.data)).toContain('Không thấy tiền');
      expect(
        await prisma.activityLog.count({ where: { action: 'order.fail_payment', targetId: order.id } }),
      ).toBe(1);
      // chuyển trạng thái không hợp lệ: đã failed thì không fail lại, không xác nhận
      expect((await api('patch', `/admin/payments/${order.payment.id}/fail`, admin)).status).toBe(409);
      expect((await api('patch', `/admin/payments/${order.payment.id}/confirm`, admin)).status).toBe(409);
      expect((await payRow(order.payment.id)).status).toBe('failed');
    });

    it('đánh dấu thất bại KHÔNG ghi đè giao dịch đã thanh toán hoặc đã hoàn tiền; lý do quá dài ⇒ 400; không cần lý do', async () => {
      const paid = await bankOrder();
      expect((await api('patch', `/admin/payments/${paid.order.payment.id}/confirm`, admin)).status).toBe(
        200,
      );
      const f1 = await api('patch', `/admin/payments/${paid.order.payment.id}/fail`, admin, {
        reason: 'nhầm',
      });
      expect(f1.status).toBe(409);
      expect((await payRow(paid.order.payment.id)).status).toBe('success');
      expect((await ordRow(paid.order.id)).paymentStatus).toBe('paid');

      const refunded = await bankOrder();
      await prisma.payment.update({ where: { id: refunded.order.payment.id }, data: { status: 'refunded' } });
      await prisma.order.update({ where: { id: refunded.order.id }, data: { paymentStatus: 'refunded' } });
      expect((await api('patch', `/admin/payments/${refunded.order.payment.id}/fail`, admin)).status).toBe(
        409,
      );
      expect((await payRow(refunded.order.payment.id)).status).toBe('refunded');

      const none = await bankOrder();
      const long = await api('patch', `/admin/payments/${none.order.payment.id}/fail`, admin, {
        reason: 'x'.repeat(256),
      });
      expect(long.status).toBe(400);
      expect((await payRow(none.order.payment.id)).status).toBe('pending');
      expect((await api('patch', `/admin/payments/${none.order.payment.id}/fail`, admin)).status).toBe(200); // không gửi lý do vẫn được
    });

    it('đồng thời: 8 yêu cầu xác nhận cùng một giao dịch ⇒ đúng một thành công, còn lại 409; một thông báo, một nhật ký', async () => {
      const { u, order } = await bankOrder();
      const rs = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          api('patch', `/admin/payments/${order.payment.id}/confirm`, admin, {
            transactionCode: tx(`par${i}`),
          }),
        ),
      );
      const codes = rs.map((r) => r.status).sort();
      expect(codes).toEqual([200, 409, 409, 409, 409, 409, 409, 409]);
      expect((await payRow(order.payment.id)).status).toBe('success');
      expect(
        await prisma.notification.count({
          where: { userId: u.id, title: `Thanh toán đơn ${order.orderCode} đã được xác nhận` },
        }),
      ).toBe(1);
      expect(
        await prisma.activityLog.count({ where: { action: 'order.confirm_payment', targetId: order.id } }),
      ).toBe(1);
    });

    it('đồng thời: xác nhận và đánh dấu thất bại cùng lúc ⇒ chỉ một thắng, trạng thái giao dịch và đơn luôn khớp nhau', async () => {
      for (let round = 0; round < 3; round++) {
        const { order } = await bankOrder();
        const rs = await Promise.all([
          api('patch', `/admin/payments/${order.payment.id}/confirm`, admin, {
            transactionCode: tx(`race${round}`),
          }),
          api('patch', `/admin/payments/${order.payment.id}/fail`, admin, { reason: 'đua' }),
          api('patch', `/admin/payments/${order.payment.id}/confirm`, admin),
        ]);
        expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
        expect(rs.every((r) => [200, 409].includes(r.status))).toBe(true);
        const p = await payRow(order.payment.id);
        const o = await ordRow(order.id);
        expect(p.status === 'success' ? 'paid' : 'failed').toBe(o.paymentStatus);
        expect(
          await prisma.activityLog.count({
            where: { targetId: order.id, action: { in: ['order.confirm_payment', 'order.fail_payment'] } },
          }),
        ).toBe(1);
      }
    });

    it('quyền của đánh dấu thất bại: 401 chưa đăng nhập, 403 khách hàng, 404 không tồn tại, 400 id sai kiểu', async () => {
      const { u, order } = await bankOrder();
      expect((await api('patch', `/admin/payments/${order.payment.id}/fail`)).status).toBe(401);
      expect((await api('patch', `/admin/payments/${order.payment.id}/fail`, u.token)).status).toBe(403);
      expect((await api('patch', '/admin/payments/999999999/fail', admin)).status).toBe(404);
      expect((await api('patch', '/admin/payments/abc/fail', admin)).status).toBe(400);
      expect((await payRow(order.payment.id)).status).toBe('pending');
    });

    it('GET /admin/payments: cần quyền; trả đủ thông tin, mới nhất trước, lọc status/method/q, phân trang, tham số sai ⇒ 400', async () => {
      expect((await api('get', '/admin/payments')).status).toBe(401);
      const a = await bankOrder();
      const b = await bankOrder();
      expect((await api('get', '/admin/payments', a.u.token)).status).toBe(403);
      await api('patch', `/admin/payments/${a.order.payment.id}/confirm`, admin, {
        transactionCode: tx('list'),
      });

      const all = await api('get', '/admin/payments?pageSize=100', admin);
      expect(all.status).toBe(200);
      expect(all.body.meta.total).toBeGreaterThanOrEqual(2);
      const items = all.body.data as Array<Record<string, unknown>>;
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          orderCode: expect.any(String),
          customerEmail: expect.any(String),
          method: expect.any(String),
          amount: expect.any(Number),
          status: expect.any(String),
        }),
      );
      const times = items.map((x) => new Date(x.createdAt as string).getTime());
      expect(times.every((t, i) => i === 0 || times[i - 1] >= t)).toBe(true);

      const pend = await api(
        'get',
        '/admin/payments?status=pending&method=bank_transfer&pageSize=100',
        admin,
      );
      expect(
        (pend.body.data as Array<{ status: string; method: string }>).every(
          (x) => x.status === 'pending' && x.method === 'bank_transfer',
        ),
      ).toBe(true);
      expect((pend.body.data as Array<{ id: number }>).map((x) => x.id)).toContain(b.order.payment.id);
      expect((pend.body.data as Array<{ id: number }>).map((x) => x.id)).not.toContain(a.order.payment.id);

      const byCode = await api(
        'get',
        `/admin/payments?q=${encodeURIComponent(a.order.orderCode.toLowerCase())}`,
        admin,
      );
      expect((byCode.body.data as Array<{ id: number }>).map((x) => x.id)).toEqual([a.order.payment.id]);
      expect((byCode.body.data as Array<{ status: string }>)[0].status).toBe('success');

      const p1 = await api('get', '/admin/payments?pageSize=1&page=1', admin);
      const p2 = await api('get', '/admin/payments?pageSize=1&page=2', admin);
      expect(p1.body.data).toHaveLength(1);
      expect(p2.body.data).toHaveLength(1);
      expect((p1.body.data as Array<{ id: number }>)[0].id).not.toBe(
        (p2.body.data as Array<{ id: number }>)[0].id,
      );
      expect(p1.body.meta.pageSize).toBe(1);

      for (const qs of ['status=hoan-thanh', 'method=paypal']) {
        const bad = await api('get', `/admin/payments?${qs}`, admin);
        expect(bad.status).toBe(400);
      }
      expect((await api('get', '/admin/payments?q=%25', admin)).status).toBe(200); // ký tự đặc biệt không lỗi
    });
  });
});
