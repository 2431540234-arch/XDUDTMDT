// E2E (supertest) UC-ADM-10 (biến thể) và UC-ADM-11 (ảnh sản phẩm) trên aurelia_test.
// Thiết kế API gộp: biến thể và ảnh nằm trong body của POST/PATCH /admin/products (không có route riêng, xem DECISIONS D-N32).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

interface Img {
  id: number;
  mediaId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  variantId: number | null;
}
interface Var {
  id: number;
  sku: string;
  isActive?: boolean;
}

describe('Biến thể và ảnh sản phẩm – admin (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  const tag = `${Date.now()}`;

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };

  const baseBody = (n: string, over: Record<string, unknown> = {}) => ({
    name: `Sản phẩm ảnh ${n} ${tag}`,
    categoryId: 3,
    status: 'published',
    shortDescription: 'Mô tả ngắn',
    description: 'Mô tả',
    material: 'Gỗ',
    ...over,
  });
  const variantBody = (sku: string, over: Record<string, unknown> = {}) => ({
    color: { name: 'Kem', hex: '#E8DCC8' },
    size: '1m6',
    sku,
    price: 1_500_000,
    stockQuantity: 5,
    ...over,
  });
  const create = async (n: string, over: Record<string, unknown> = {}) => {
    const r = await api('post', '/admin/products', admin, baseBody(n, over));
    expect(r.status).toBe(201);
    return r.body.data as { id: number; slug: string; images: Img[]; variants: Var[] };
  };
  const get = async (id: number) =>
    (await api('get', `/admin/products/${id}`, admin)).body.data as { images: Img[]; variants: Var[] };
  const rows = (productId: number) =>
    prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } });
  const ref = (i: Img, extra: Record<string, unknown> = {}) => ({ mediaId: i.mediaId, ...extra });

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

  // ------------------------------------------------------------------ UC-ADM-11 ảnh
  describe('UC-ADM-11 ảnh sản phẩm', () => {
    it('quyền: không đăng nhập ⇒ 401, khách hàng ⇒ 403', async () => {
      expect((await api('post', '/admin/products', undefined, baseBody('q'))).status).toBe(401);
      const email = `img-cust-${tag}@test.local`;
      await api('post', '/auth/register', undefined, {
        fullName: 'Khách ảnh',
        email,
        phone: '0911222333',
        password: 'matkhau-12345',
      });
      const l = await api('post', '/auth/login', undefined, { email, password: 'matkhau-12345' });
      const tok = l.body.data.tokens.accessToken as string;
      expect((await api('post', '/admin/products', tok, baseBody('q'))).status).toBe(403);
      expect((await api('patch', '/admin/products/1', tok, baseBody('q'))).status).toBe(403);
    });

    it('thêm nhiều ảnh: có mediaId, thứ tự 1..n, đúng một ảnh đại diện (mặc định ảnh đầu)', async () => {
      const p = await create('them', {
        variants: [variantBody(`IMG-${tag}-1`)],
        images: [{ url: PNG }, { url: PNG }, { url: PNG }],
      });
      expect(p.images).toHaveLength(3);
      expect(p.images.map((i) => i.sortOrder)).toEqual([1, 2, 3]);
      expect(p.images.map((i) => i.isPrimary)).toEqual([true, false, false]);
      expect(new Set(p.images.map((i) => i.mediaId)).size).toBe(3);
      expect(await prisma.productImage.count({ where: { productId: p.id, isPrimary: true } })).toBe(1);
    });

    it('sắp xếp lại theo mediaId: giữ nguyên id dòng, không tạo media mới, đại diện giữ nguyên', async () => {
      const p = await create('xep', {
        variants: [variantBody(`IMG-${tag}-2`)],
        images: [{ url: PNG }, { url: PNG }, { url: PNG }],
      });
      const [a, b, c] = p.images;
      const mediaBefore = await prisma.media.count();
      const r = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('xep'),
        variants: [variantBody(`IMG-${tag}-2`, { id: p.variants[0].id })],
        images: [ref(c), ref(a), ref(b)],
      });
      expect(r.status).toBe(200);
      const after = r.body.data.images as Img[];
      expect(after.map((i) => i.mediaId)).toEqual([c.mediaId, a.mediaId, b.mediaId]);
      expect(after.map((i) => i.id)).toEqual([c.id, a.id, b.id]); // cùng dòng, không xóa-tạo lại
      expect(after.map((i) => i.sortOrder)).toEqual([1, 2, 3]);
      expect(after.find((i) => i.mediaId === a.mediaId)!.isPrimary).toBe(true); // ảnh đại diện cũ vẫn là đại diện
      expect(await prisma.media.count()).toBe(mediaBefore);
    });

    it('gửi lại URL như giao diện cũ: không tạo ảnh/media mới; chọn ảnh đại diện mới ⇒ vẫn đúng một đại diện', async () => {
      const p = await create('url', {
        variants: [variantBody(`IMG-${tag}-3`)],
        images: [{ url: PNG }, { url: PNG }],
      });
      const mediaBefore = await prisma.media.count();
      const r = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('url'),
        variants: [variantBody(`IMG-${tag}-3`, { id: p.variants[0].id })],
        images: p.images.map((i, idx) => ({ url: i.url, isPrimary: idx === 1 })),
      });
      expect(r.status).toBe(200);
      expect((r.body.data.images as Img[]).map((i) => i.id)).toEqual(p.images.map((i) => i.id));
      expect((r.body.data.images as Img[]).map((i) => i.isPrimary)).toEqual([false, true]);
      expect(await prisma.media.count()).toBe(mediaBefore);
      expect(await prisma.productImage.count({ where: { productId: p.id, isPrimary: true } })).toBe(1);
    });

    it('liên kết ảnh với biến thể: giữ khi không gửi variantId, gỡ bằng null, từ chối biến thể của sản phẩm khác', async () => {
      const p = await create('lienket', {
        variants: [
          variantBody(`IMG-${tag}-4A`),
          variantBody(`IMG-${tag}-4B`, { color: { name: 'Đen', hex: '#2B2B2B' } }),
        ],
        images: [{ url: PNG }, { url: PNG }],
      });
      const [va, vb] = p.variants;
      const [i1, i2] = p.images;
      const variants = [
        variantBody(`IMG-${tag}-4A`, { id: va.id }),
        variantBody(`IMG-${tag}-4B`, { id: vb.id, color: { name: 'Đen', hex: '#2B2B2B' } }),
      ];
      const put = (images: object[]) =>
        api('patch', `/admin/products/${p.id}`, admin, { ...baseBody('lienket'), variants, images });

      const linked = await put([ref(i1, { variantId: va.id }), ref(i2, { variantId: vb.id })]);
      expect(linked.status).toBe(200);
      expect((linked.body.data.images as Img[]).map((i) => i.variantId)).toEqual([va.id, vb.id]);

      // lưu lại KHÔNG gửi variantId (giao diện chỉ gửi url) ⇒ liên kết được giữ nguyên
      const keep = await put([{ url: i1.url }, { url: i2.url }]);
      expect((keep.body.data.images as Img[]).map((i) => i.variantId)).toEqual([va.id, vb.id]);

      // null ⇒ gỡ liên kết của ảnh đó
      const unlink = await put([ref(i1, { variantId: null }), ref(i2)]);
      expect((unlink.body.data.images as Img[]).map((i) => i.variantId)).toEqual([null, vb.id]);

      // biến thể của sản phẩm khác ⇒ 400 theo trường, không đổi gì
      const other = await create('khac', {
        variants: [variantBody(`IMG-${tag}-4C`)],
        images: [{ url: PNG }],
      });
      const bad = await put([ref(i1, { variantId: other.variants[0].id }), ref(i2)]);
      expect(bad.status).toBe(400);
      expect(Object.keys(bad.body.error.details)).toContain('images.0.variantId');
      expect((await rows(p.id)).map((r) => r.variantId)).toEqual([null, vb.id]);
    });

    it('mediaId không tồn tại ⇒ 400; thiếu cả mediaId lẫn url ⇒ 400; không ghi gì', async () => {
      const p = await create('loi', {
        variants: [variantBody(`IMG-${tag}-5`)],
        images: [{ url: PNG }, { url: PNG }],
      });
      const snapshot = JSON.stringify(
        (await rows(p.id)).map((r) => [r.id, r.mediaId, r.sortOrder, r.isPrimary]),
      );
      for (const images of [[{ mediaId: 999_999_999 }], [{}], [{ mediaId: 'abc' }]]) {
        const r = await api('patch', `/admin/products/${p.id}`, admin, {
          ...baseBody('loi'),
          variants: [variantBody(`IMG-${tag}-5`, { id: p.variants[0].id })],
          images,
        });
        expect(r.status).toBe(400);
      }
      expect(JSON.stringify((await rows(p.id)).map((r) => [r.id, r.mediaId, r.sortOrder, r.isPrimary]))).toBe(
        snapshot,
      );
    });

    it('gỡ ảnh: xóa dòng liên kết nhưng KHÔNG xóa media; media đang dùng ở sản phẩm khác vẫn nguyên', async () => {
      const a = await create('go-a', {
        variants: [variantBody(`IMG-${tag}-6A`)],
        images: [{ url: PNG }, { url: PNG }],
      });
      const [i1, i2] = a.images;
      // sản phẩm B dùng chung media của i1
      const b = await create('go-b', {
        variants: [variantBody(`IMG-${tag}-6B`)],
        images: [ref(i1 as Img) as never],
      });
      expect(b.images[0].mediaId).toBe(i1.mediaId);

      const r = await api('patch', `/admin/products/${a.id}`, admin, {
        ...baseBody('go-a'),
        variants: [variantBody(`IMG-${tag}-6A`, { id: a.variants[0].id })],
        images: [ref(i2)],
      });
      expect(r.status).toBe(200);
      expect((r.body.data.images as Img[]).map((i) => i.mediaId)).toEqual([i2.mediaId]);
      expect((r.body.data.images as Img[])[0].isPrimary).toBe(true); // ảnh đại diện cũ bị gỡ ⇒ ảnh còn lại làm đại diện
      expect(await prisma.productImage.count({ where: { id: i1.id } })).toBe(0);
      expect(await prisma.media.count({ where: { id: i1.mediaId } })).toBe(1); // media vẫn còn
      expect((await get(b.id)).images.map((i) => i.mediaId)).toEqual([i1.mediaId]); // sản phẩm B không bị ảnh hưởng
    });

    it('danh sách rỗng gỡ hết ảnh (không còn đại diện); không gửi images thì giữ nguyên; ảnh trùng chỉ giữ một', async () => {
      const p = await create('rong', {
        variants: [variantBody(`IMG-${tag}-7`)],
        images: [{ url: PNG }, { url: PNG }],
      });
      const v = [variantBody(`IMG-${tag}-7`, { id: p.variants[0].id })];
      const noImages = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('rong'),
        variants: v,
      });
      expect(noImages.status).toBe(200);
      expect((noImages.body.data.images as Img[]).map((i) => i.id)).toEqual(p.images.map((i) => i.id));

      const dup = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('rong'),
        variants: v,
        images: [ref(p.images[0]), ref(p.images[0]), ref(p.images[1])],
      });
      expect((dup.body.data.images as Img[]).map((i) => i.mediaId)).toEqual([
        p.images[0].mediaId,
        p.images[1].mediaId,
      ]);

      const empty = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('rong'),
        variants: v,
        images: [],
      });
      expect(empty.status).toBe(200);
      expect(empty.body.data.images).toEqual([]);
      expect(await prisma.productImage.count({ where: { productId: p.id } })).toBe(0);
      expect(await prisma.media.count({ where: { id: { in: p.images.map((i) => i.mediaId) } } })).toBe(2);
    });

    it('nguyên tử: lưu lỗi ở phần ảnh thì thay đổi biến thể/tên cùng lần lưu cũng không được áp dụng', async () => {
      const p = await create('nguyentu', { variants: [variantBody(`IMG-${tag}-8`)], images: [{ url: PNG }] });
      const r = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('nguyentu', { name: `Tên mới không được lưu ${tag}` }),
        variants: [variantBody(`IMG-${tag}-8`, { id: p.variants[0].id, price: 9_999_000 })],
        images: [{ mediaId: 999_999_999 }],
      });
      expect(r.status).toBe(400);
      const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } });
      expect(Number(v.price)).toBe(1_500_000);
      const prod = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
      expect(prod.name).not.toContain('Tên mới không được lưu');
    });

    it('lưu đồng thời cùng một sản phẩm: không lỗi 5xx; cuối cùng đúng một đại diện, không trùng media, thứ tự liên tục', async () => {
      const p = await create('songsong', {
        variants: [variantBody(`IMG-${tag}-9`)],
        images: [{ url: PNG }, { url: PNG }, { url: PNG }, { url: PNG }],
      });
      const orders = [
        [3, 2, 1, 0],
        [1, 0, 3, 2],
        [2, 3, 0, 1],
        [0, 1, 2, 3],
        [3, 0, 2, 1],
        [1, 2, 3, 0],
      ];
      const results = await Promise.all(
        orders.map((o, k) =>
          api('patch', `/admin/products/${p.id}`, admin, {
            ...baseBody('songsong'),
            variants: [variantBody(`IMG-${tag}-9`, { id: p.variants[0].id })],
            images: o.map((idx, pos) => ref(p.images[idx], { isPrimary: pos === k % 4 })),
          }),
        ),
      );
      expect(results.every((r) => r.status === 200)).toBe(true);
      const final = await rows(p.id);
      expect(final).toHaveLength(4);
      expect(new Set(final.map((r) => r.mediaId)).size).toBe(4);
      expect(final.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4]);
      expect(final.filter((r) => r.isPrimary)).toHaveLength(1);
    });
  });

  // ------------------------------------------------------------------ UC-ADM-10 biến thể
  describe('UC-ADM-10 biến thể sản phẩm', () => {
    it('tạo biến thể: SKU, giá, tồn ban đầu ghi movement import; thuộc tính (màu, kích thước, chất liệu) được gắn', async () => {
      const p = await create('bt', {
        variants: [
          variantBody(`VAR-${tag}-1A`, { salePrice: 1_200_000, stockQuantity: 7 }),
          variantBody(`VAR-${tag}-1B`, { color: { name: 'Đen', hex: '#2B2B2B' }, stockQuantity: 0 }),
        ],
      });
      expect(p.variants).toHaveLength(2);
      const va = await prisma.productVariant.findFirstOrThrow({ where: { sku: `VAR-${tag}-1A` } });
      expect(Number(va.salePrice)).toBe(1_200_000);
      expect(va.stockQuantity).toBe(7);
      expect(
        await prisma.inventoryMovement.count({
          where: { variantId: va.id, type: 'import', quantityChange: 7 },
        }),
      ).toBe(1);
      const vb = await prisma.productVariant.findFirstOrThrow({ where: { sku: `VAR-${tag}-1B` } });
      expect(await prisma.inventoryMovement.count({ where: { variantId: vb.id } })).toBe(0); // tồn 0 ⇒ không có phiếu nhập
      const attrs = await prisma.variantAttributeValue.findMany({
        where: { variantId: va.id },
        include: { attributeValue: true },
      });
      const codes = await prisma.attribute.findMany({
        where: { id: { in: attrs.map((a) => a.attributeId) } },
      });
      expect(codes.map((c) => c.code).sort()).toEqual(['color', 'material', 'size']);
      const colorAttr = codes.find((c) => c.code === 'color')!;
      expect(attrs.find((a) => a.attributeId === colorAttr.id)!.attributeValue.value).toBe('Kem');
    });

    it('validation: SKU trống, giá ≤ 0, giá khuyến mãi > giá, tồn âm ⇒ 400 theo trường; SKU trùng ⇒ 409; không ghi gì', async () => {
      const productsBefore = await prisma.product.count();
      const bad = async (v: Record<string, unknown>, field: string) => {
        const r = await api(
          'post',
          '/admin/products',
          admin,
          baseBody('val', { variants: [variantBody(`VAL-${tag}`, v)] }),
        );
        expect(r.status).toBe(400);
        expect(Object.keys(r.body.error.details)).toContain(field);
      };
      await bad({ sku: '' }, 'variants.0.sku');
      await bad({ price: 0 }, 'variants.0.price');
      await bad({ price: -5 }, 'variants.0.price');
      await bad({ salePrice: 2_000_000 }, 'variants.0.salePrice');
      await bad({ stockQuantity: -1 }, 'variants.0.stockQuantity');
      expect(await prisma.product.count()).toBe(productsBefore);

      const exist = await create('trung', { variants: [variantBody(`DUP-${tag}`)] });
      expect(exist.variants).toHaveLength(1);
      const dupOther = await api(
        'post',
        '/admin/products',
        admin,
        baseBody('trung2', { variants: [variantBody(`DUP-${tag}`)] }),
      );
      expect(dupOther.status).toBe(409);
      expect(dupOther.body.error.details.fields).toContain('sku');
      const dupSelf = await api(
        'post',
        '/admin/products',
        admin,
        baseBody('trung3', {
          variants: [
            variantBody(`SELF-${tag}`),
            variantBody(`self-${tag}`, { color: { name: 'Đen', hex: '#000000' } }),
          ],
        }),
      );
      expect(dupSelf.status).toBe(409);
      expect(await prisma.product.count({ where: { name: { contains: `trung3 ${tag}` } } })).toBe(0); // giao dịch hoàn tác
    });

    it('sửa tồn kho qua biến thể ghi movement adjustment đúng chênh lệch; sửa giá/khuyến mãi lưu đúng', async () => {
      const p = await create('ton', { variants: [variantBody(`TON-${tag}`, { stockQuantity: 10 })] });
      const id = p.variants[0].id;
      const r = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('ton'),
        variants: [
          variantBody(`TON-${tag}`, { id, stockQuantity: 4, price: 2_000_000, salePrice: 1_800_000 }),
        ],
      });
      expect(r.status).toBe(200);
      const v = await prisma.productVariant.findUniqueOrThrow({ where: { id } });
      expect([v.stockQuantity, Number(v.price), Number(v.salePrice)]).toEqual([4, 2_000_000, 1_800_000]);
      const adj = await prisma.inventoryMovement.findMany({ where: { variantId: id, type: 'adjustment' } });
      expect(adj.map((m) => m.quantityChange)).toEqual([-6]);
      // không đổi tồn ⇒ không thêm phiếu
      await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('ton'),
        variants: [
          variantBody(`TON-${tag}`, { id, stockQuantity: 4, price: 2_000_000, salePrice: 1_800_000 }),
        ],
      });
      expect(await prisma.inventoryMovement.count({ where: { variantId: id, type: 'adjustment' } })).toBe(1);
    });

    it('bỏ biến thể khỏi danh sách ⇒ isActive=false (không xóa); giữ lịch sử kho và dòng đơn hàng; xóa khỏi giỏ; gửi lại id thì bán lại', async () => {
      const p = await create('lichsu', {
        variants: [
          variantBody(`HIS-${tag}-A`, { stockQuantity: 30 }),
          variantBody(`HIS-${tag}-B`, { color: { name: 'Đen', hex: '#000000' }, stockQuantity: 30 }),
        ],
      });
      const [va, vb] = p.variants;
      // khách đặt hàng biến thể B và để biến thể B trong giỏ của khách khác
      const email = `his-${tag}@test.local`;
      await api('post', '/auth/register', undefined, {
        fullName: 'Khách lịch sử',
        email,
        phone: '0911222333',
        password: 'matkhau-12345',
      });
      const tok = (await api('post', '/auth/login', undefined, { email, password: 'matkhau-12345' })).body
        .data.tokens.accessToken as string;
      const addr = (
        await api('post', '/addresses', tok, {
          recipientName: 'Nguyễn Văn A',
          phone: '0912345678',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          addressLine: '12 Lê Lợi',
        })
      ).body.data;
      await api('post', '/cart/items', tok, { variantId: vb.id, quantity: 1 });
      const order = await api('post', '/orders', tok, { addressId: addr.id, paymentMethod: 'cod' });
      expect(order.status).toBe(201);
      await api('post', '/cart/items', tok, { variantId: vb.id, quantity: 1 });
      expect(await prisma.cartItem.count({ where: { variantId: vb.id } })).toBe(1);
      const movements = await prisma.inventoryMovement.count({ where: { variantId: vb.id } });
      expect(movements).toBeGreaterThan(0);

      const r = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('lichsu'),
        variants: [variantBody(`HIS-${tag}-A`, { id: va.id, stockQuantity: 30 })],
      });
      expect(r.status).toBe(200);
      const vbRow = await prisma.productVariant.findUniqueOrThrow({ where: { id: vb.id } });
      expect(vbRow.isActive).toBe(false); // KHÔNG bị xóa
      expect(await prisma.inventoryMovement.count({ where: { variantId: vb.id } })).toBe(movements); // lịch sử kho còn nguyên
      expect(await prisma.orderItem.count({ where: { variantId: vb.id } })).toBe(1); // đơn cũ vẫn trỏ tới biến thể
      expect(await prisma.cartItem.count({ where: { variantId: vb.id } })).toBe(0); // giỏ hàng bị dọn
      // công khai chỉ thấy biến thể đang bán; quản trị vẫn thấy đủ (kèm cờ isActive) để có thể bán lại
      const pub = await api('get', `/products/${p.slug}`);
      expect((pub.body.data.variants as Var[]).map((v) => v.id)).toEqual([va.id]);
      const adm = (await get(p.id)).variants;
      expect(adm.map((v) => [v.id, v.isActive])).toEqual([
        [va.id, true],
        [vb.id, false],
      ]);

      const back = await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('lichsu'),
        variants: [
          variantBody(`HIS-${tag}-A`, { id: va.id, stockQuantity: 30 }),
          variantBody(`HIS-${tag}-B`, {
            id: vb.id,
            color: { name: 'Đen', hex: '#000000' },
            stockQuantity: 29,
          }),
        ],
      });
      expect(back.status).toBe(200);
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: vb.id } })).isActive).toBe(true);
    });

    it('ngừng bán biến thể không làm mất liên kết ảnh đã gắn với biến thể đó', async () => {
      const p = await create('anhbt', {
        variants: [
          variantBody(`ABT-${tag}-A`),
          variantBody(`ABT-${tag}-B`, { color: { name: 'Đen', hex: '#000000' } }),
        ],
        images: [{ url: PNG }, { url: PNG }],
      });
      const [va, vb] = p.variants;
      const [i1, i2] = p.images;
      const full = [
        variantBody(`ABT-${tag}-A`, { id: va.id }),
        variantBody(`ABT-${tag}-B`, { id: vb.id, color: { name: 'Đen', hex: '#000000' } }),
      ];
      await api('patch', `/admin/products/${p.id}`, admin, {
        ...baseBody('anhbt'),
        variants: full,
        images: [ref(i1, { variantId: va.id }), ref(i2, { variantId: vb.id })],
      });
      await api('patch', `/admin/products/${p.id}`, admin, { ...baseBody('anhbt'), variants: [full[0]] });
      const after = await rows(p.id);
      expect(after.map((r) => r.variantId)).toEqual([va.id, vb.id]);
      expect(after).toHaveLength(2);
    });
  });
});
