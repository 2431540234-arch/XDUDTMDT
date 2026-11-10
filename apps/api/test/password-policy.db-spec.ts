// E2E (supertest) chính sách mật khẩu theo DAC_TA UC-AUTH-01 / UC-AUTH-06 / UC-ACC-02 (D-N35): ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số;
// confirmPassword bắt buộc và phải khớp. Chạy trên aurelia_test.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { MAIL_SERVICE, type MailMessage } from '../src/mail/mail.service';

const GOOD = 'Matkhau-12345';
const BAD: Array<[string, string]> = [
  ['thiếu chữ hoa', 'matkhau-12345'],
  ['thiếu chữ thường', 'MATKHAU-12345'],
  ['thiếu chữ số', 'Matkhau-abcde'],
  ['dưới 8 ký tự', 'Ab1cdef'],
  ['chỉ chữ số', '12345678'],
  ['chuỗi rỗng', ''],
];

describe('Chính sách mật khẩu (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  const outbox: MailMessage[] = [];
  let seq = 0;
  const tag = `${Date.now()}`;

  type Method = 'get' | 'post' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const reg = (over: Record<string, unknown> = {}) =>
    api('post', '/auth/register', undefined, {
      fullName: 'Khách chính sách',
      email: `pol-${tag}-${++seq}@test.local`,
      phone: '0911222333',
      password: GOOD,
      confirmPassword: GOOD,
      ...over,
    });
  const login = async (email: string, password: string) => {
    const r = await api('post', '/auth/login', undefined, { email, password });
    return r;
  };
  const customer = async () => {
    const email = `pol-${tag}-${++seq}@test.local`;
    expect((await reg({ email })).status).toBe(201);
    const l = await login(email, GOOD);
    return {
      email,
      access: l.body.data.tokens.accessToken as string,
      refresh: l.body.data.tokens.refreshToken as string,
    };
  };
  const fieldErr = (r: { body: { error: { details?: Record<string, string[]> } } }, field: string) =>
    r.body.error.details?.[field]?.[0];

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_SERVICE)
      .useValue({ send: async (m: MailMessage) => void outbox.push(m) })
      .compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  describe('UC-AUTH-01 đăng ký', () => {
    it.each(BAD)(
      '%s ⇒ 400 theo trường password, không tạo tài khoản, lỗi không lộ mật khẩu',
      async (_label, pw) => {
        const email = `pol-${tag}-bad-${++seq}@test.local`;
        const r = await reg({ email, password: pw, confirmPassword: pw });
        expect(r.status).toBe(400);
        expect(fieldErr(r, 'password')).toBe(
          'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.',
        );
        if (pw.length >= 4) expect(JSON.stringify(r.body)).not.toContain(pw);
        expect(await prisma.user.count({ where: { email } })).toBe(0);
      },
    );

    it('thiếu confirmPassword hoặc không khớp ⇒ 400 theo trường confirmPassword', async () => {
      const email = `pol-${tag}-conf-${++seq}@test.local`;
      const missing = await api('post', '/auth/register', undefined, {
        fullName: 'Khách',
        email,
        phone: '0911222333',
        password: GOOD,
      });
      expect(missing.status).toBe(400);
      expect(fieldErr(missing, 'confirmPassword')).toBe('Mật khẩu xác nhận không khớp.');
      const diff = await reg({ email, confirmPassword: 'Matkhau-12346' });
      expect(diff.status).toBe(400);
      expect(fieldErr(diff, 'confirmPassword')).toBe('Mật khẩu xác nhận không khớp.');
      expect(JSON.stringify(diff.body)).not.toContain(GOOD);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('hợp lệ ⇒ 201; đăng nhập được bằng mật khẩu đó; băm bcrypt', async () => {
      const email = `pol-${tag}-ok-${++seq}@test.local`;
      const r = await reg({ email });
      expect(r.status).toBe(201);
      expect(JSON.stringify(r.body)).not.toContain(GOOD);
      expect((await login(email, GOOD)).status).toBe(200);
      const row = await prisma.user.findFirstOrThrow({ where: { email } });
      expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('họ tên 2–150 ký tự, email ≤ 255 ký tự, điện thoại tuỳ chọn 10–11 chữ số bắt đầu bằng 0', async () => {
      expect(fieldErr(await reg({ fullName: 'A' }), 'fullName')).toBeTruthy();
      expect(fieldErr(await reg({ fullName: 'A'.repeat(151) }), 'fullName')).toBeTruthy();
      expect((await reg({ fullName: 'Ab' })).status).toBe(201);
      expect(fieldErr(await reg({ email: `${'a'.repeat(250)}@test.local` }), 'email')).toBeTruthy();
      expect(fieldErr(await reg({ email: 'khong-hop-le' }), 'email')).toBeTruthy();
      // điện thoại: bỏ trống được; 10 và 11 số được; sai thì 400
      expect((await reg({ phone: undefined })).status).toBe(201);
      expect((await reg({ phone: '' })).status).toBe(201);
      expect((await reg({ phone: '0911222333' })).status).toBe(201);
      expect((await reg({ phone: '09112223334' })).status).toBe(201);
      for (const phone of [
        '911222333',
        '091122233',
        '091122233345',
        '1911222333',
        'abcdefghij',
        '0911 222 333',
      ]) {
        const r = await reg({ phone });
        expect([phone, r.status]).toEqual([phone, 400]);
        expect(fieldErr(r, 'phone')).toBeTruthy();
      }
      // lưu null khi bỏ trống
      const email = `pol-${tag}-nophone-${++seq}@test.local`;
      await reg({ email, phone: undefined });
      expect((await prisma.user.findFirstOrThrow({ where: { email } })).phone).toBeNull();
    });
  });

  describe('UC-ACC-02 đổi mật khẩu', () => {
    const change = (token: string, body: object) => api('post', '/users/me/change-password', token, body);

    it.each(BAD.filter(([, pw]) => pw !== ''))(
      'mật khẩu mới %s ⇒ 400 theo trường newPassword; mật khẩu không đổi',
      async (_l, pw) => {
        const c = await customer();
        const before = (await prisma.user.findFirstOrThrow({ where: { email: c.email } })).passwordHash;
        const r = await change(c.access, { currentPassword: GOOD, newPassword: pw, confirmPassword: pw });
        expect(r.status).toBe(400);
        expect(fieldErr(r, 'newPassword')).toBeTruthy();
        expect(JSON.stringify(r.body)).not.toContain(pw);
        expect((await prisma.user.findFirstOrThrow({ where: { email: c.email } })).passwordHash).toBe(before);
      },
    );

    it('thiếu hoặc lệch confirmPassword ⇒ 400; đúng chính sách và khớp ⇒ 200', async () => {
      const c = await customer();
      const next = 'Matkhau-Moi-77';
      const missing = await change(c.access, { currentPassword: GOOD, newPassword: next });
      expect(missing.status).toBe(400);
      expect(fieldErr(missing, 'confirmPassword')).toBe('Mật khẩu xác nhận không khớp.');
      const diff = await change(c.access, {
        currentPassword: GOOD,
        newPassword: next,
        confirmPassword: 'Matkhau-Moi-78',
      });
      expect(diff.status).toBe(400);
      expect(fieldErr(diff, 'confirmPassword')).toBeTruthy();
      expect((await login(c.email, GOOD)).status).toBe(200); // chưa đổi
      const ok = await change(c.access, { currentPassword: GOOD, newPassword: next, confirmPassword: next });
      expect(ok.status).toBe(200);
      expect((await login(c.email, next)).status).toBe(200);
      expect((await login(c.email, GOOD)).status).toBe(401);
    });

    it('mật khẩu hiện tại sai, mới trùng cũ ⇒ 400; chọn logoutOthers vẫn giữ phiên hiện tại', async () => {
      const c = await customer();
      const second = (await login(c.email, GOOD)).body.data.tokens;
      const wrong = await change(c.access, {
        currentPassword: 'Sai-matkhau-1',
        newPassword: 'Matkhau-Moi-77',
        confirmPassword: 'Matkhau-Moi-77',
      });
      expect(wrong.status).toBe(400);
      expect(fieldErr(wrong, 'currentPassword')).toBeTruthy();
      const same = await change(c.access, {
        currentPassword: GOOD,
        newPassword: GOOD,
        confirmPassword: GOOD,
      });
      expect(same.status).toBe(400);
      expect(fieldErr(same, 'newPassword')).toMatch(/khác/);
      const ok = await change(c.access, {
        currentPassword: GOOD,
        newPassword: 'Matkhau-Moi-77',
        confirmPassword: 'Matkhau-Moi-77',
        logoutOthers: true,
      });
      expect(ok.status).toBe(200);
      expect((await api('get', '/users/me', c.access)).status).toBe(200); // phiên hiện tại còn
      expect((await api('get', '/users/me', second.accessToken)).status).toBe(401); // phiên khác bị thu hồi
    });
  });

  describe('UC-AUTH-06 đặt lại mật khẩu', () => {
    const tokenOf = (m: MailMessage) => /token=([0-9a-f]{64})/.exec(m.html ?? m.text ?? '')![1];
    const issue = async (email: string) => {
      outbox.length = 0;
      expect((await api('post', '/auth/forgot-password', undefined, { email })).status).toBe(200);
      return tokenOf(outbox[outbox.length - 1]);
    };
    const reset = (token: string, body: object) =>
      api('post', '/auth/reset-password', undefined, { token, ...body });

    it.each(BAD)('mật khẩu mới %s ⇒ 400 theo trường newPassword; token chưa bị dùng', async (_l, pw) => {
      const c = await customer();
      const token = await issue(c.email);
      const r = await reset(token, { newPassword: pw, confirmPassword: pw });
      expect(r.status).toBe(400);
      expect(fieldErr(r, 'newPassword')).toBeTruthy();
      if (pw) expect(JSON.stringify(r.body)).not.toContain(pw);
      // token vẫn dùng được cho mật khẩu hợp lệ
      const ok = await reset(token, { newPassword: 'Matkhau-Moi-77', confirmPassword: 'Matkhau-Moi-77' });
      expect(ok.status).toBe(200);
    });

    it('thiếu/lệch confirmPassword ⇒ 400; hợp lệ ⇒ 200, thu hồi mọi phiên, token chỉ dùng một lần; tên cũ `password` vẫn được nhận', async () => {
      const c = await customer();
      const token = await issue(c.email);
      const next = 'Matkhau-Moi-88';
      expect(fieldErr(await reset(token, { newPassword: next }), 'confirmPassword')).toBeTruthy();
      expect(
        fieldErr(
          await reset(token, { newPassword: next, confirmPassword: 'Matkhau-Moi-89' }),
          'confirmPassword',
        ),
      ).toBeTruthy();
      expect((await login(c.email, GOOD)).status).toBe(200); // chưa đổi
      const ok = await reset(token, { newPassword: next, confirmPassword: next });
      expect(ok.status).toBe(200);
      expect((await login(c.email, next)).status).toBe(200);
      expect((await login(c.email, GOOD)).status).toBe(401);
      expect((await api('get', '/users/me', c.access)).status).toBe(401); // mọi phiên cũ bị thu hồi
      expect((await reset(token, { newPassword: next, confirmPassword: next })).status).toBe(400); // dùng lại token

      const c2 = await customer();
      const t2 = await issue(c2.email);
      expect((await reset(t2, { password: 'Matkhau-Cu-55', confirmPassword: 'Matkhau-Cu-55' })).status).toBe(
        200,
      );
      expect((await login(c2.email, 'Matkhau-Cu-55')).status).toBe(200);
    });
  });

  it('đăng nhập KHÔNG áp chính sách mới: tài khoản có mật khẩu cũ yếu vẫn đăng nhập được', async () => {
    const admin = await login('admin@aurelia.vn', 'admin123');
    expect(admin.status).toBe(200);
    const cust = await login('khachhang@aurelia.vn', '123456');
    expect(cust.status).toBe(200);
  });
});
