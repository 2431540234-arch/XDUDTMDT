// E2E (supertest) Mốc 5 phần web trên aurelia_test: thương hiệu, thuộc tính, media, vận chuyển.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { derivedKeys } from '../src/modules/jobs/image-processing/image-processing.service';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Mốc 5 (web) – thương hiệu, thuộc tính, media, vận chuyển (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';

  const api = (
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
    token?: string,
    body?: object,
  ) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) => {
    const r = await api('post', '/auth/login', undefined, { email, password, adminOnly });
    expect(r.status).toBe(200);
    return r.body.data.tokens.accessToken as string;
  };
  const lastLog = (action: string) =>
    prisma.activityLog.findFirst({ where: { action }, orderBy: { id: 'desc' } });

  beforeAll(async () => {
    const [{ db, users }] = await prisma.$queryRaw<
      Array<{ db: string; users: bigint }>
    >`SELECT current_database() AS db, (SELECT count(*) FROM users) AS users`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    if (Number(users) < 30)
      throw new Error('aurelia_test chưa seed: chạy node scripts/db-reset.mjs aurelia_test');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  // ------------------------------------------------------------------------------------------ UC-ADM-06 thương hiệu
  describe('thương hiệu (UC-ADM-06)', () => {
    it('phân quyền: khách ⇒ 403, chưa đăng nhập ⇒ 401', async () => {
      for (const [m, p] of [
        ['get', '/admin/brands'],
        ['post', '/admin/brands'],
        ['patch', '/admin/brands/1'],
        ['delete', '/admin/brands/1'],
      ] as const) {
        expect((await api(m, p, cust, {})).status).toBe(403);
        expect((await api(m, p, undefined, {})).status).toBe(401);
      }
    });

    it('thêm: tên bắt buộc ≤ 150, slug tự sinh, slug trùng ⇒ 409, logo lưu thành media, ghi activity_logs', async () => {
      const bad = await api('post', '/admin/brands', admin, { name: '   ' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.details).toHaveProperty('name');
      expect((await api('post', '/admin/brands', admin, { name: 'x'.repeat(151) })).status).toBe(400);

      const ok = await api('post', '/admin/brands', admin, { name: 'Hãng Gỗ Việt', logoUrl: PNG });
      expect(ok.status).toBe(201);
      expect(ok.body.data).toMatchObject({
        name: 'Hãng Gỗ Việt',
        slug: 'hang-go-viet',
        isActive: true,
        productCount: 0,
      });
      expect(ok.body.data.logoUrl).toMatch(/^https?:\/\//);
      const log = await lastLog('brand.create');
      expect(log).toMatchObject({ actorId: 1, targetType: 'brand', targetId: ok.body.data.id });

      const dup = await api('post', '/admin/brands', admin, { name: 'Tên khác', slug: 'hang-go-viet' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.details).toHaveProperty('slug');
      // trùng slug sinh từ tên
      expect((await api('post', '/admin/brands', admin, { name: 'Hãng Gỗ Việt' })).status).toBe(409);
    });

    it('sửa: đổi tên giữ slug; đổi slug trùng ⇒ 409; bật/tắt; gửi lại slug của chính nó không báo trùng; 404', async () => {
      const b = (await api('post', '/admin/brands', admin, { name: 'Hãng A', slug: 'hang-a' })).body.data;
      const other = (await api('post', '/admin/brands', admin, { name: 'Hãng B', slug: 'hang-b' })).body.data;
      const ren = await api('patch', `/admin/brands/${b.id}`, admin, { name: 'Hãng A đổi tên' });
      expect(ren.status).toBe(200);
      expect(ren.body.data).toMatchObject({ name: 'Hãng A đổi tên', slug: 'hang-a' });
      expect((await api('patch', `/admin/brands/${b.id}`, admin, { slug: 'hang-b' })).status).toBe(409);
      expect((await api('patch', `/admin/brands/${b.id}`, admin, { slug: 'hang-a' })).status).toBe(200);
      expect(
        (await api('patch', `/admin/brands/${b.id}`, admin, { slug: 'hang-a-moi' })).body.data.slug,
      ).toBe('hang-a-moi');
      const off = await api('patch', `/admin/brands/${b.id}`, admin, { isActive: false });
      expect(off.body.data.isActive).toBe(false);
      expect((await api('patch', `/admin/brands/${b.id}`, admin, { isActive: 'khong' })).status).toBe(400);
      // thương hiệu tắt không còn ở danh sách công khai (ô chọn của khách), vẫn có ở admin
      expect((await api('get', '/brands')).body.data.some((x: { id: number }) => x.id === b.id)).toBe(false);
      expect(
        (await api('get', '/admin/brands', admin)).body.data.some((x: { id: number }) => x.id === b.id),
      ).toBe(true);
      const log = await lastLog('brand.update');
      expect(log!.changes).toMatchObject({ after: { slug: 'hang-a-moi' } });
      expect((await api('patch', '/admin/brands/999999', admin, { name: 'x' })).status).toBe(404);
      expect(other.id).toBeGreaterThan(0);
    });

    it('danh sách: số sản phẩm đúng, tìm không dấu; xóa thương hiệu đang có sản phẩm ⇒ sản phẩm brandId = NULL, nhật ký cùng transaction', async () => {
      const b = (await api('post', '/admin/brands', admin, { name: 'Thương hiệu để xóa' })).body.data;
      const prods = await prisma.product.findMany({
        where: { deletedAt: null },
        take: 2,
        orderBy: { id: 'asc' },
      });
      await prisma.product.updateMany({
        where: { id: { in: prods.map((p) => p.id) } },
        data: { brandId: b.id },
      });
      const list = await api('get', '/admin/brands?q=thuong%20hieu%20de%20xoa', admin);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].productCount).toBe(2);

      const del = await api('delete', `/admin/brands/${b.id}`, admin);
      expect(del.status).toBe(200);
      expect(del.body.data).toEqual({ id: b.id, productsDetached: 2 });
      expect(await prisma.brand.count({ where: { id: b.id } })).toBe(0);
      for (const p of prods)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).brandId).toBeNull();
      const log = await lastLog('brand.delete');
      expect(log!.changes).toMatchObject({ name: 'Thương hiệu để xóa', productsDetached: 2 });
      expect((await api('delete', `/admin/brands/${b.id}`, admin)).status).toBe(404);
    });

    it('thao tác lỗi giữa chừng không để lại bản ghi nhật ký lẻ (ghi + nhật ký cùng transaction)', async () => {
      const before = await prisma.activityLog.count({ where: { action: 'brand.create' } });
      expect((await api('post', '/admin/brands', admin, { name: 'Hãng Gỗ Việt' })).status).toBe(409); // trùng slug ⇒ không ghi gì
      expect(await prisma.activityLog.count({ where: { action: 'brand.create' } })).toBe(before);
    });
  });

  // ------------------------------------------------------------------------------------------ UC-ADM-08 thuộc tính
  describe('thuộc tính và giá trị (UC-ADM-08)', () => {
    it('phân quyền: khách ⇒ 403, chưa đăng nhập ⇒ 401', async () => {
      for (const [m, p] of [
        ['get', '/admin/attributes'],
        ['post', '/admin/attributes'],
        ['post', '/admin/attributes/1/values'],
        ['delete', '/admin/attributes/1/values/1'],
      ] as const) {
        expect((await api(m, p, cust, {})).status).toBe(403);
        expect((await api(m, p, undefined, {})).status).toBe(401);
      }
    });

    it('danh sách kèm giá trị và số biến thể đang dùng', async () => {
      const r = await api('get', '/admin/attributes', admin);
      expect(r.status).toBe(200);
      const color = r.body.data.find((a: { code: string }) => a.code === 'color');
      expect(color).toMatchObject({ name: expect.any(String), isSystem: true });
      expect(color.values.length).toBeGreaterThan(0);
      expect(color.values[0]).toMatchObject({
        value: expect.any(String),
        colorHex: expect.any(String),
        usageCount: expect.any(Number),
      });
      const used = await prisma.variantAttributeValue.count({
        where: { attributeValueId: color.values[0].id },
      });
      expect(color.values[0].usageCount).toBe(used);
    });

    it('thêm thuộc tính: kiểm tra mã (chữ thường ≤ 50) và tên (≤ 100); trùng mã/tên ⇒ 409; nhật ký', async () => {
      const bad = await api('post', '/admin/attributes', admin, { code: 'Mau Sac', name: '' });
      expect(bad.status).toBe(400);
      expect(Object.keys(bad.body.error.details).sort()).toEqual(['code', 'name']);
      expect(
        (await api('post', '/admin/attributes', admin, { code: 'a'.repeat(51), name: 'x' })).status,
      ).toBe(400);
      expect(
        (await api('post', '/admin/attributes', admin, { code: 'ok', name: 'n'.repeat(101) })).status,
      ).toBe(400);

      const ok = await api('post', '/admin/attributes', admin, { code: 'finish', name: 'Hoàn thiện bề mặt' });
      expect(ok.status).toBe(201);
      expect(ok.body.data).toMatchObject({
        code: 'finish',
        name: 'Hoàn thiện bề mặt',
        isSystem: false,
        values: [],
      });
      expect(
        await prisma.activityLog.findFirst({
          where: { action: 'attribute.create', targetId: ok.body.data.id },
        }),
      ).not.toBeNull();

      const dupCode = await api('post', '/admin/attributes', admin, { code: 'finish', name: 'Tên khác' });
      expect(dupCode.status).toBe(409);
      expect(dupCode.body.error.details).toHaveProperty('code');
      const dupName = await api('post', '/admin/attributes', admin, {
        code: 'finish2',
        name: 'Hoàn thiện bề mặt',
      });
      expect(dupName.status).toBe(409);
      expect(dupName.body.error.details).toHaveProperty('name');
    });

    it('giá trị: thêm/sửa/trùng (attributeId, value) ⇒ 409; màu cần #RRGGBB; chỉ thuộc tính màu có mã màu; 404', async () => {
      const attr = (await api('post', '/admin/attributes', admin, { code: 'texture', name: 'Vân bề mặt' }))
        .body.data;
      const a = await api('post', `/admin/attributes/${attr.id}/values`, admin, { value: 'Nhám' });
      expect(a.status).toBe(201);
      expect(a.body.data).toMatchObject({ value: 'Nhám', colorHex: null, usageCount: 0 });
      expect(
        (await api('post', `/admin/attributes/${attr.id}/values`, admin, { value: 'Nhám' })).status,
      ).toBe(409);
      expect((await api('post', `/admin/attributes/${attr.id}/values`, admin, { value: '' })).status).toBe(
        400,
      );
      expect(
        (await api('post', `/admin/attributes/${attr.id}/values`, admin, { value: 'v'.repeat(151) })).status,
      ).toBe(400);
      expect(
        (
          await api('post', `/admin/attributes/${attr.id}/values`, admin, {
            value: 'Bóng',
            colorHex: '#FFFFFF',
          })
        ).status,
      ).toBe(400); // không phải màu
      const b = (await api('post', `/admin/attributes/${attr.id}/values`, admin, { value: 'Bóng' })).body
        .data;
      // đổi thành giá trị đã có ⇒ 409; đổi hợp lệ ⇒ 200; gửi lại đúng tên của nó không báo trùng
      expect(
        (await api('patch', `/admin/attributes/${attr.id}/values/${b.id}`, admin, { value: 'Nhám' })).status,
      ).toBe(409);
      expect(
        (await api('patch', `/admin/attributes/${attr.id}/values/${b.id}`, admin, { value: 'Bóng' })).status,
      ).toBe(200);
      expect(
        (await api('patch', `/admin/attributes/${attr.id}/values/${b.id}`, admin, { value: 'Bóng mờ' })).body
          .data.value,
      ).toBe('Bóng mờ');
      expect(
        (await api('patch', `/admin/attributes/${attr.id}/values/999999`, admin, { value: 'x' })).status,
      ).toBe(404);
      // giá trị thuộc thuộc tính khác không sửa được qua id thuộc tính sai
      expect(
        (await api('patch', `/admin/attributes/${attr.id + 1}/values/${b.id}`, admin, { value: 'x' })).status,
      ).toBe(404);

      // màu sắc: mã màu hợp lệ, chuẩn hóa chữ hoa; sai định dạng ⇒ 400
      const color = (await api('get', '/admin/attributes', admin)).body.data.find(
        (x: { code: string }) => x.code === 'color',
      );
      expect(
        (
          await api('post', `/admin/attributes/${color.id}/values`, admin, {
            value: 'Xanh lá cọ',
            colorHex: 'xanh',
          })
        ).status,
      ).toBe(400);
      const moss = await api('post', `/admin/attributes/${color.id}/values`, admin, {
        value: 'Xanh lá cọ',
        colorHex: '#6b8e23',
      });
      expect(moss.status).toBe(201);
      expect(moss.body.data.colorHex).toBe('#6B8E23');
      expect(
        (await api('post', `/admin/attributes/${color.id}/values`, admin, { value: 'Xanh lá cọ' })).status,
      ).toBe(409);
      expect(
        await prisma.activityLog.findFirst({
          where: { action: 'attribute_value.create', targetId: moss.body.data.id },
        }),
      ).not.toBeNull();
    });

    it('xóa giá trị đang được biến thể dùng ⇒ 409 và KHÔNG xóa dây chuyền; chưa dùng ⇒ xóa được', async () => {
      const vav = await prisma.variantAttributeValue.findFirstOrThrow({ include: { attributeValue: true } });
      const before = await prisma.variantAttributeValue.count({
        where: { attributeValueId: vav.attributeValueId },
      });
      const res = await api(
        'delete',
        `/admin/attributes/${vav.attributeValue.attributeId}/values/${vav.attributeValueId}`,
        admin,
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESOURCE_IN_USE');
      expect(res.body.error.message).toContain('đang được');
      expect(await prisma.attributeValue.count({ where: { id: vav.attributeValueId } })).toBe(1);
      expect(
        await prisma.variantAttributeValue.count({ where: { attributeValueId: vav.attributeValueId } }),
      ).toBe(before);

      const attr = (await api('get', '/admin/attributes', admin)).body.data.find(
        (x: { code: string }) => x.code === 'texture',
      );
      const free = attr.values[0];
      const del = await api('delete', `/admin/attributes/${attr.id}/values/${free.id}`, admin);
      expect(del.status).toBe(200);
      expect(await prisma.attributeValue.count({ where: { id: free.id } })).toBe(0);
      expect(
        await prisma.activityLog.findFirst({
          where: { action: 'attribute_value.delete', targetId: free.id },
        }),
      ).not.toBeNull();
      expect((await api('delete', `/admin/attributes/${attr.id}/values/${free.id}`, admin)).status).toBe(404);
    });

    it('sửa/xóa thuộc tính: thuộc tính hệ thống không đổi mã/không xóa; thuộc tính tự tạo xóa được', async () => {
      const list = (await api('get', '/admin/attributes', admin)).body.data;
      const color = list.find((x: { code: string }) => x.code === 'color');
      expect((await api('patch', `/admin/attributes/${color.id}`, admin, { code: 'mau' })).status).toBe(400);
      expect((await api('patch', `/admin/attributes/${color.id}`, admin, { name: color.name })).status).toBe(
        200,
      );
      expect((await api('delete', `/admin/attributes/${color.id}`, admin)).status).toBe(409);
      const fin = list.find((x: { code: string }) => x.code === 'finish');
      expect((await api('patch', `/admin/attributes/${fin.id}`, admin, { name: color.name })).status).toBe(
        409,
      ); // trùng tên
      expect(
        (await api('patch', `/admin/attributes/${fin.id}`, admin, { name: 'Bề mặt hoàn thiện' })).body.data
          .name,
      ).toBe('Bề mặt hoàn thiện');
      const tex = list.find((x: { code: string }) => x.code === 'texture');
      expect((await api('delete', `/admin/attributes/${tex.id}`, admin)).status).toBe(200);
      expect(await prisma.attribute.count({ where: { code: 'texture' } })).toBe(0);
      expect((await api('delete', `/admin/attributes/${tex.id}`, admin)).status).toBe(404);
    });

    it('giá trị mới dùng được ngay khi lưu biến thể; sau đó đang dùng ⇒ không xóa được', async () => {
      const color = (await api('get', '/admin/attributes', admin)).body.data.find(
        (x: { code: string }) => x.code === 'color',
      );
      const moss = color.values.find((v: { value: string }) => v.value === 'Xanh lá cọ');
      expect(moss).toBeTruthy();
      const p = await prisma.product.findFirstOrThrow({ where: { deletedAt: null }, orderBy: { id: 'asc' } });
      const detail = (await api('get', `/admin/products/${p.id}`, admin)).body.data;
      const variants = detail.variants.map((v: Record<string, unknown>) => ({ ...v }));
      variants[0].color = { name: moss.value, hex: moss.colorHex };
      const save = await api('patch', `/admin/products/${p.id}`, admin, {
        name: detail.name,
        categoryId: detail.category?.id ?? p.categoryId,
        shortDescription: detail.shortDescription ?? p.shortDescription ?? 'Mô tả ngắn của sản phẩm',
        variants,
      });
      if (save.status !== 200) throw new Error(JSON.stringify(save.body));
      expect((await api('delete', `/admin/attributes/${color.id}/values/${moss.id}`, admin)).status).toBe(
        409,
      );
    });
  });

  // ------------------------------------------------------------------------------------------ UC-ADM-04 media
  describe('thư viện media (UC-ADM-04)', () => {
    const PNG_BYTES = Buffer.from(PNG.split(',')[1], 'base64');
    const MB = 1024 * 1024;
    const upload = (
      buf: Buffer,
      mime: string,
      extra: Record<string, string> = {},
      token = admin,
      name = 'anh.png',
    ) => {
      const r = http.post('/api/admin/media').set('Authorization', `Bearer ${token}`);
      for (const [k, v] of Object.entries(extra)) r.field(k, v);
      return r.attach('file', buf, { filename: name, contentType: mime });
    };

    it('phân quyền: khách ⇒ 403, chưa đăng nhập ⇒ 401', async () => {
      for (const [m, p] of [
        ['get', '/admin/media'],
        ['patch', '/admin/media/1'],
        ['delete', '/admin/media/1'],
      ] as const) {
        expect((await api(m, p, cust, {})).status).toBe(403);
        expect((await api(m, p, undefined, {})).status).toBe(401);
      }
      expect((await upload(PNG_BYTES, 'image/png', {}, cust)).status).toBe(403);
    });

    it('tải lên: ảnh hợp lệ 201 kèm url/mime/size/altText + nhật ký; quá 5 MB ⇒ 413; sai loại ⇒ 415; chữ ký không khớp ⇒ 415; thiếu tệp ⇒ 400', async () => {
      const ok = await upload(PNG_BYTES, 'image/png', { altText: 'Ảnh thử' }, admin, '../../ảnh thử.png');
      expect(ok.status).toBe(201);
      expect(ok.body.data).toMatchObject({
        fileName: 'ảnh thử.png',
        mimeType: 'image/png',
        fileSize: PNG_BYTES.length,
        altText: 'Ảnh thử',
      });
      expect(ok.body.data.url ?? ok.body.data.filePath).toBeTruthy();
      expect(
        await prisma.activityLog.findFirst({ where: { action: 'media.upload', targetId: ok.body.data.id } }),
      ).not.toBeNull();

      const big = Buffer.concat([PNG_BYTES, Buffer.alloc(5 * MB)]);
      expect((await upload(big, 'image/png')).status).toBe(413);
      expect((await upload(Buffer.from('%PDF-1.4'), 'application/pdf')).status).toBe(415);
      expect((await upload(Buffer.from('<html>giả png</html>'), 'image/png')).status).toBe(415); // chữ ký sai
      expect((await upload(PNG_BYTES, 'image/jpeg')).status).toBe(415); // PNG khai báo là JPEG
      expect((await upload(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'image/jpeg')).status).toBe(201);
      expect((await http.post('/api/admin/media').set('Authorization', `Bearer ${admin}`)).status).toBe(400);
      // chỉ tệp hợp lệ mới tạo bản ghi
      expect(
        await prisma.media.count({ where: { fileName: { in: ['anh.png'] }, fileSize: { gt: 5 * MB } } }),
      ).toBe(0);
    });

    it('danh sách: phân trang, tìm theo tên/alt không dấu, lọc chưa dùng, có số nơi đang dùng', async () => {
      const a = await upload(PNG_BYTES, 'image/png', { altText: 'Chiếc sofa xám' }, admin, 'sofa-xam.png');
      const list = await api('get', '/admin/media?pageSize=5', admin);
      expect(list.status).toBe(200);
      expect(list.body.meta).toMatchObject({ page: 1, pageSize: 5 });
      expect(list.body.data).toHaveLength(5);
      expect(list.body.data[0].id).toBe(a.body.data.id); // mới nhất trước
      expect(list.body.data[0]).toMatchObject({
        usage: { required: 0, optional: 0 },
        uploadedByName: expect.any(String),
      });
      const found = await api('get', '/admin/media?q=sofa%20xam', admin);
      expect(found.body.data.some((m: { id: number }) => m.id === a.body.data.id)).toBe(true);
      const unused = await api('get', '/admin/media?usage=unused&pageSize=100', admin);
      expect(
        unused.body.data.every(
          (m: { usage: { required: number; optional: number } }) => m.usage.required + m.usage.optional === 0,
        ),
      ).toBe(true);
      // ảnh sản phẩm đang dùng ⇒ usage.required > 0
      const pi = await prisma.productImage.findFirstOrThrow();
      const all = await api('get', '/admin/media?pageSize=500', admin);
      const mine = all.body.data.find((m: { id: number }) => m.id === pi.mediaId);
      if (mine) expect(mine.usage.required).toBeGreaterThan(0);
    });

    it('job image-processing: sau khi tải lên có bản webp + thumbnail trên kho; xóa tệp ⇒ xóa cả bản gốc và bản sinh ra', async () => {
      const storage = app.get(STORAGE_SERVICE) as StorageService;
      const m = (await upload(PNG_BYTES, 'image/png', {}, admin, 'job.png')).body.data;
      const row = await prisma.media.findUniqueOrThrow({ where: { id: m.id } });
      const { webpKey, thumbKey } = derivedKeys(row.filePath);
      const waitFor = async (key: string, present: boolean) => {
        for (let i = 0; i < 40; i++) {
          if (Boolean(await storage.head(key, 'public')) === present) return true;
          await new Promise((r) => setTimeout(r, 250));
        }
        return false;
      };
      expect(await waitFor(webpKey, true)).toBe(true);
      expect(await waitFor(thumbKey, true)).toBe(true);
      expect((await api('delete', `/admin/media/${m.id}`, admin)).status).toBe(200);
      expect(await storage.head(row.filePath, 'public')).toBeNull();
      expect(await storage.head(webpKey, 'public')).toBeNull();
      expect(await storage.head(thumbKey, 'public')).toBeNull();
    });

    it('sửa altText: lưu, xóa trắng ⇒ null, > 255 ký tự ⇒ 400, id lạ ⇒ 404; nhật ký', async () => {
      const m = (await upload(PNG_BYTES, 'image/png', {}, admin, 'alt.png')).body.data;
      const r = await api('patch', `/admin/media/${m.id}`, admin, { altText: 'Mô tả mới' });
      expect(r.status).toBe(200);
      expect(r.body.data.altText).toBe('Mô tả mới');
      expect(
        (await api('patch', `/admin/media/${m.id}`, admin, { altText: '' })).body.data.altText,
      ).toBeNull();
      const bad = await api('patch', `/admin/media/${m.id}`, admin, { altText: 'x'.repeat(256) });
      expect(bad.status).toBe(400);
      expect(bad.body.error.details).toHaveProperty('altText');
      expect((await api('patch', '/admin/media/999999', admin, { altText: 'x' })).status).toBe(404);
      expect(
        await prisma.activityLog.findFirst({ where: { action: 'media.update', targetId: m.id } }),
      ).not.toBeNull();
    });

    it('xóa: tệp chưa dùng ⇒ xóa được + nhật ký; ảnh đang dùng (ảnh sản phẩm) ⇒ 409 và còn nguyên; ảnh đại diện danh mục ⇒ xóa và gỡ liên kết (SET NULL)', async () => {
      const m = (await upload(PNG_BYTES, 'image/png', {}, admin, 'xoa.png')).body.data;
      const del = await api('delete', `/admin/media/${m.id}`, admin);
      expect(del.status).toBe(200);
      expect(await prisma.media.count({ where: { id: m.id } })).toBe(0);
      expect(
        await prisma.activityLog.findFirst({ where: { action: 'media.delete', targetId: m.id } }),
      ).not.toBeNull();
      expect((await api('delete', `/admin/media/${m.id}`, admin)).status).toBe(404);

      const pi = await prisma.productImage.findFirstOrThrow();
      const inUse = await api('delete', `/admin/media/${pi.mediaId}`, admin);
      expect(inUse.status).toBe(409);
      expect(inUse.body.error.code).toBe('RESOURCE_IN_USE');
      expect(await prisma.media.count({ where: { id: pi.mediaId } })).toBe(1);
      expect(await prisma.productImage.count({ where: { id: pi.id } })).toBe(1);

      const cat = await prisma.category.findFirstOrThrow({ where: { imageMediaId: { not: null } } });
      const optional = await api('delete', `/admin/media/${cat.imageMediaId}`, admin);
      expect(optional.status).toBe(200);
      expect((await prisma.category.findUniqueOrThrow({ where: { id: cat.id } })).imageMediaId).toBeNull();
    });
  });
});
