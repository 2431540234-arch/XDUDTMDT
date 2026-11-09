// E2E (supertest) trên aurelia_test: UC-ACC-04 sổ địa chỉ, UC-ACC-01 cập nhật hồ sơ, UC-ACC-06 yêu thích, UC-SPACE-04 lưu không gian,
// UC-ADM-24 xác nhận thanh toán chuyển khoản. Mỗi test tự đăng ký khách riêng (đúng luồng thật) nên không phụ thuộc dữ liệu seed.
// Số thứ tự UC theo docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md. Chỗ mã KHÁC đặc tả được ghi bằng it.todo ở cuối tệp.
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
      await bad({ phone: '09123456789' }, 'phone'); // 11 số: mã hiện chỉ nhận 10 (xem it.todo cuối tệp)
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

    it('xóa: địa chỉ thường; xóa mặc định ⇒ một địa chỉ còn lại thành mặc định; không xóa địa chỉ cuối cùng; của người khác/không có ⇒ 404', async () => {
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

      // địa chỉ cuối cùng được giữ lại (409)
      const last = await api('delete', `/addresses/${b.id}`, u.token);
      expect(last.status).toBe(409);
      expect(last.body.error.code).toBe('INVALID_STATE');
      expect(await prisma.address.count({ where: { id: b.id } })).toBe(1);
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
  });

  // ------------------------------------------------------------------ Điểm lệch so với DAC_TA (chờ chủ dự án quyết định)
  it.todo(
    'DAC_TA UC-ACC-04: phone 10–11 chữ số (mã hiện chỉ nhận đúng 10 chữ số, PHONE_RE ở common/utils/validate.ts)',
  );
  it.todo(
    'DAC_TA UC-ACC-04 [ĐỀ XUẤT]: xóa địa chỉ mặc định ⇒ địa chỉ MỚI NHẤT thành mặc định (mã chọn địa chỉ CŨ nhất còn lại; test chỉ kiểm có đúng một mặc định)',
  );
  it.todo(
    'Mã chặn xóa địa chỉ cuối cùng (409) – DAC_TA UC-ACC-04 không nêu quy tắc này; chờ chủ dự án xác nhận',
  );
  it.todo(
    'DAC_TA UC-SPACE-04 3a: lưu không gian chưa đăng bán/đã ẩn ⇒ 404 (mã SpacesService.bookmark tìm theo slug, không kiểm status nên lưu được cả không gian nháp)',
  );
  it.todo(
    'DAC_TA UC-SPACE-04: trả 204 và có GET /api/spaces/bookmarks/me + trang /account/saved-spaces (mã trả 200 body null; danh sách đã lưu lấy bằng GET /spaces?bookmarked=true; FE chưa có trang riêng)',
  );
  it.todo(
    'UC-ADM-24: xác nhận thanh toán cho đơn đã bị hủy (cancelled) hiện vẫn được phép (đặt paid); DAC_TA/D-N28 chưa quy định riêng cho đường quản trị – chờ chủ dự án',
  );
});
