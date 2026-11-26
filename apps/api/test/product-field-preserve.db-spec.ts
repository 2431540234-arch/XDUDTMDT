// UC-ADM-09/10 – Cập nhật sản phẩm: trường KHÔNG được gửi lên thì giữ nguyên giá trị cũ; gửi null/rỗng mới là xóa.
// Chạy trên aurelia_test.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type Body = Record<string, unknown>;

describe('Cập nhật sản phẩm giữ nguyên trường không gửi lên (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  const tag = `${Date.now()}`;
  let seq = 0;

  const send = (method: 'post' | 'patch', path: string, body: object) =>
    http[method](`/api${path}`).set('Authorization', `Bearer ${admin}`).send(body);

  const product = (id: number) => prisma.product.findUniqueOrThrow({ where: { id } });

  /** Biến thể đọc thẳng từ DB, kèm thuộc tính, để so trước/sau */
  const variantRows = async (productId: number) =>
    (
      await prisma.productVariant.findMany({
        where: { productId },
        orderBy: { id: 'asc' },
        include: { variantAttributeValues: { include: { attributeValue: true } } },
      })
    ).map((v) => {
      const attr = (code: string) =>
        v.variantAttributeValues.find((x) => x.attributeCode === code)?.attributeValue.value ?? null;
      return {
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        salePrice: v.salePrice === null ? null : Number(v.salePrice),
        stockQuantity: v.stockQuantity,
        isActive: v.isActive,
        color: attr('color'),
        size: attr('size'),
        material: attr('material'),
      };
    });

  /**
   * Sản phẩm có đủ giá trị khác mặc định: nổi bật, thương hiệu, mô tả, SEO; `count` biến thể có màu, cỡ, giá khuyến mãi.
   * `patch(over)` gửi thân tối thiểu hợp lệ (không có trường đang kiểm tra) cộng `over`.
   */
  async function setup(count = 2, over: Body = {}) {
    const n = ++seq;
    const colors = [
      { name: 'Kem', hex: '#E8DCC8' },
      { name: 'Đen', hex: '#2B2B2B' },
    ];
    const variant = (i: number) => ({
      color: colors[i],
      size: `1m${6 + i}`,
      sku: `KEEP-${tag}-${n}-${i}`,
      price: 2_000_000,
      salePrice: 1_800_000,
      stockQuantity: 5 + i,
    });
    const created = await send('post', '/admin/products', {
      name: `Sản phẩm giữ trường ${n} ${tag}`,
      categoryId: 3,
      status: 'published',
      isFeatured: true,
      brand: 'Hãng Giữ',
      shortDescription: 'Mô tả ngắn',
      description: 'Mô tả chi tiết cần giữ',
      metaTitle: 'Tiêu đề SEO cần giữ',
      metaDescription: 'Mô tả SEO cần giữ',
      material: 'Gỗ',
      variants: Array.from({ length: count }, (_, i) => variant(i)),
      images: [{ url: PNG }],
      ...over,
    });
    if (created.status !== 201) throw new Error(JSON.stringify(created.body));
    const id = created.body.data.id as number;
    const ids = (await variantRows(id)).map((v) => v.id);
    /** Biến thể gửi lên chỉ gồm trường bắt buộc */
    const bare = ids.map((vid, i) => ({
      id: vid,
      sku: variant(i).sku,
      price: 2_000_000,
      stockQuantity: 5 + i,
    }));
    const full = ids.map((vid, i) => ({ id: vid, ...variant(i) }));
    const base = { name: `Sản phẩm giữ trường ${n} ${tag}`, categoryId: 3, shortDescription: 'Mô tả ngắn' };
    const patch = async (extra: Body, expected = 200) => {
      const r = await send('patch', `/admin/products/${id}`, { ...base, ...extra });
      if (r.status !== expected) throw new Error(`${r.status} ${JSON.stringify(r.body)}`);
      return r;
    };
    return { id, base, patch, full, bare, variant, sku: (i: number) => variant(i).sku };
  }

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

  describe('trường của sản phẩm', () => {
    it('không gửi isFeatured ⇒ giữ cờ nổi bật', async () => {
      const s = await setup();
      await s.patch({ status: 'published', variants: s.full });
      expect((await product(s.id)).isFeatured).toBe(true);
    });

    it.each(['draft', 'archived'])('không gửi status ⇒ sản phẩm "%s" không bị tự đăng', async (status) => {
      const s = await setup(2, { status });
      await s.patch({ variants: s.full });
      expect((await product(s.id)).status).toBe(status);
    });

    it('bản nháp không có ảnh, không gửi status ⇒ lưu được, không bị đòi ảnh đại diện', async () => {
      const s = await setup(2, { status: 'draft', images: [] });
      await s.patch({ variants: s.full });
      expect((await product(s.id)).status).toBe('draft');
    });

    it.each([
      ['brand', 'Hãng Giữ'],
      ['description', 'Mô tả chi tiết cần giữ'],
      ['metaTitle', 'Tiêu đề SEO cần giữ'],
      ['metaDescription', 'Mô tả SEO cần giữ'],
    ] as const)('không gửi %s ⇒ giữ nguyên', async (field, value) => {
      const s = await setup();
      await s.patch({ variants: s.full });
      expect((await product(s.id))[field]).toBe(value);
    });

    it('đối chứng: gửi giá trị rỗng/null/false ⇒ vẫn xóa hoặc đổi được', async () => {
      const s = await setup();
      await s.patch({
        variants: s.full,
        isFeatured: false,
        status: 'draft',
        brand: null,
        description: '',
        metaTitle: '',
        metaDescription: null,
      });
      expect(await product(s.id)).toMatchObject({
        isFeatured: false,
        status: 'draft',
        brand: null,
        description: '',
        metaTitle: null,
        metaDescription: null,
      });
      await s.patch({ variants: s.full, isFeatured: true });
      expect((await product(s.id)).isFeatured).toBe(true);
    });

    it('đối chứng: tạo mới không gửi isFeatured/status ⇒ mặc định không nổi bật, đang bán', async () => {
      const s = await setup(1, { isFeatured: undefined, status: undefined });
      expect(await product(s.id)).toMatchObject({ isFeatured: false, status: 'published' });
    });
  });

  describe('trường của biến thể', () => {
    it('không gửi salePrice, color, size trong biến thể ⇒ giữ nguyên', async () => {
      const s = await setup();
      const before = await variantRows(s.id);
      await s.patch({ material: 'Gỗ', variants: s.bare });
      expect(await variantRows(s.id)).toEqual(before);
    });

    it.each([
      ['salePrice', 'salePrice'],
      ['color', 'color'],
      ['size', 'size'],
    ] as const)('không gửi %s ⇒ giữ nguyên (các trường khác vẫn cập nhật)', async (key, column) => {
      const s = await setup();
      const before = await variantRows(s.id);
      const variants = s.full.map((v) => {
        const next: Body = { ...v, stockQuantity: 30 };
        delete next[key];
        return next;
      });
      await s.patch({ material: 'Gỗ', variants });
      const after = await variantRows(s.id);
      expect(after.map((v) => v[column])).toEqual(before.map((v) => v[column]));
      expect(after.map((v) => v.stockQuantity)).toEqual([30, 30]);
    });

    it('đối chứng: gửi salePrice/color/size = null ⇒ bỏ giá khuyến mãi, gỡ màu, cỡ về "Tiêu chuẩn"', async () => {
      const s = await setup();
      await s.patch({ variants: s.full.map((v) => ({ ...v, salePrice: null, color: null, size: null })) });
      for (const v of await variantRows(s.id))
        expect(v).toMatchObject({ salePrice: null, color: null, size: 'Tiêu chuẩn' });
    });

    it('không gửi material ⇒ mỗi biến thể giữ chất liệu của mình, kể cả khi khác nhau', async () => {
      const s = await setup();
      // dữ liệu có hai chất liệu khác nhau (form chỉ có một ô chất liệu chung nên dựng thẳng trong DB)
      const other =
        (await prisma.attributeValue.findFirst({ where: { attributeCode: 'material', value: 'Da' } })) ??
        (await prisma.attributeValue.create({ data: { attributeCode: 'material', value: 'Da' } }));
      await prisma.variantAttributeValue.updateMany({
        where: { variantId: s.full[1].id, attributeCode: 'material' },
        data: { attributeValueId: other.id },
      });
      await s.patch({ variants: s.full });
      expect((await variantRows(s.id)).map((v) => v.material)).toEqual(['Gỗ', 'Da']);
    });

    it('không gửi material, thêm biến thể mới ⇒ biến thể mới nhận chất liệu chung của sản phẩm', async () => {
      const s = await setup(1);
      await s.patch({ variants: [...s.full, { ...s.variant(1) }] });
      expect((await variantRows(s.id)).map((v) => v.material)).toEqual(['Gỗ', 'Gỗ']);
    });

    it('đối chứng: gửi material = null ⇒ gỡ chất liệu; gửi giá trị ⇒ áp cho mọi biến thể', async () => {
      const s = await setup();
      await s.patch({ variants: s.full, material: 'Kính' });
      expect((await variantRows(s.id)).map((v) => v.material)).toEqual(['Kính', 'Kính']);
      await s.patch({ variants: s.full, material: null });
      expect((await variantRows(s.id)).map((v) => v.material)).toEqual([null, null]);
    });

    it('đối chứng: màu gửi không kèm mã hex ⇒ không đổi mã màu dùng chung', async () => {
      const s = await setup();
      const hex = () =>
        prisma.attributeValue.findFirstOrThrow({ where: { attributeCode: 'color', value: 'Kem' } });
      const before = (await hex()).colorHex;
      await s.patch({ variants: s.full.map((v) => ({ ...v, color: { name: v.color.name } })) });
      expect((await hex()).colorHex).toBe(before);
    });
  });

  describe('không gửi mảng variants', () => {
    it('nhiều biến thể: giữ nguyên mọi biến thể và giỏ hàng, không đòi price/stock', async () => {
      const s = await setup();
      const before = await variantRows(s.id);
      const cart = await prisma.cart.findFirstOrThrow({ orderBy: { id: 'asc' } });
      await prisma.cartItem.create({ data: { cartId: cart.id, variantId: before[1].id, quantity: 1 } });
      await s.patch({ name: `${s.base.name} (đổi tên)` });
      expect(await variantRows(s.id)).toEqual(before);
      expect(await prisma.cartItem.count({ where: { variantId: before[1].id } })).toBe(1);
    });

    it('nhiều biến thể, có gửi price/stock/sku ⇒ vẫn không gộp biến thể', async () => {
      const s = await setup();
      const before = await variantRows(s.id);
      await s.patch({ sku: s.sku(0), price: 999_000, stock: 1 });
      expect(await variantRows(s.id)).toEqual(before);
    });

    it('một biến thể: price/stock gửi lên được áp vào nó; màu, cỡ, chất liệu giữ nguyên', async () => {
      const s = await setup(1);
      const [before] = await variantRows(s.id);
      await s.patch({ price: 1_700_000, stock: 42 });
      // originalPrice không gửi ⇒ giữ giá niêm yết 2.000.000, giá bán mới là giá khuyến mãi
      expect(await variantRows(s.id)).toEqual([
        { ...before, price: 2_000_000, salePrice: 1_700_000, stockQuantity: 42 },
      ]);
    });

    it('một biến thể, chỉ gửi stock ⇒ giá và giá khuyến mãi giữ nguyên', async () => {
      const s = await setup(1);
      const [before] = await variantRows(s.id);
      await s.patch({ stock: 3 });
      expect(await variantRows(s.id)).toEqual([{ ...before, stockQuantity: 3 }]);
    });

    it('một biến thể: giá hoặc tồn kho không hợp lệ ⇒ 400', async () => {
      const s = await setup(1);
      await s.patch({ price: 0 }, 400);
      await s.patch({ stock: -1 }, 400);
    });

    it('đối chứng: gửi variants = [] ⇒ gộp về một biến thể mặc định (admin xóa hết dòng biến thể)', async () => {
      const s = await setup();
      await s.patch({ variants: [], sku: s.sku(0), price: 1_500_000, stock: 9 });
      const after = await variantRows(s.id);
      expect(after.map((v) => v.isActive)).toEqual([true, false]);
      expect(after[0]).toMatchObject({ price: 1_500_000, salePrice: null, stockQuantity: 9, color: null });
    });
  });
});
