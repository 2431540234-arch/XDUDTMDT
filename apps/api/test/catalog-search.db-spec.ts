// E2E (supertest) UC-CAT-02 (duyệt/lọc/sắp xếp/phân trang), UC-CAT-03 (tìm kiếm), UC-CAT-06 (tìm không dấu) trên aurelia_test.
// Viết theo HÀNH VI THẬT của mã (ProductsService.list/search: chỉ mục trong bộ nhớ + foldVi), đối chiếu số liệu với CSDL.
// Quyết định chủ dự án 2026-11-09 (D-T51): danh mục không có/không hoạt động ⇒ 404; từ khóa 1 ký tự ⇒ rỗng; còn lại giữ cơ chế hiện tại.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CatalogCache } from '../src/cache/catalog-cache';
import { foldVi } from '../src/common/utils/vi-fold';

interface Item {
  id: number;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  soldCount: number;
  ratingAvg: number | string;
  categoryId: number | null;
  brandId: number | null;
  has3dModel: boolean;
  isFeatured: boolean;
  createdAt: string;
  colors: Array<{ name: string }>;
  category?: { name: string } | null;
  shortDescription?: string | null;
}

describe('Duyệt, lọc, tìm kiếm sản phẩm (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cache: CatalogCache;
  let all: Item[] = [];

  const get = (path: string) => http.get(`/api${path}`);
  const list = async (qs = '') => {
    const r = await get(`/products${qs}`);
    expect(r.status).toBe(200);
    return {
      items: r.body.data as Item[],
      meta: r.body.meta as { page: number; pageSize: number; total: number },
    };
  };
  const search = async (q: string, extra = '') => {
    const r = await get(`/products/search?q=${encodeURIComponent(q)}${extra}`);
    expect(r.status).toBe(200);
    return {
      items: r.body.data as Item[],
      meta: r.body.meta as { page: number; pageSize: number; total: number },
    };
  };
  const eff = (i: Item) => i.salePrice ?? i.price;
  const slugs = (xs: Item[]) => xs.map((x) => x.slug);

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
    cache = app.get(CatalogCache);
    // mồi chỉ mục để `all` đọc từ cache (thứ tự ổn định); lần dựng đầu tiên được kiểm riêng ở test "yêu cầu đầu tiên sau khi xóa cache"
    await get('/products?pageSize=1');
    all = (await list('?pageSize=100')).items;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  // ------------------------------------------------------------------ UC-CAT-02
  describe('UC-CAT-02 duyệt theo danh mục, lọc, sắp xếp, phân trang', () => {
    it('chỉ trả sản phẩm đã đăng bán, chưa xóa; tổng khớp CSDL', async () => {
      const dbCount = await prisma.product.count({ where: { status: 'published', deletedAt: null } });
      expect(dbCount).toBeGreaterThan(10);
      const r = await list('?pageSize=100');
      expect(r.meta.total).toBe(dbCount);
      expect(r.items).toHaveLength(dbCount);
      expect(new Set(r.items.map((i) => i.id)).size).toBe(dbCount); // không trùng
    });

    it('lọc theo danh mục cha gồm cả sản phẩm của danh mục con; danh mục lá chỉ có của chính nó', async () => {
      const parent = await prisma.category.findFirstOrThrow({ where: { slug: 'phong-khach' } });
      const kids = await prisma.category.findMany({ where: { parentId: parent.id } });
      const ids = [parent.id, ...kids.map((k) => k.id)];
      const expected = await prisma.product.findMany({
        where: { status: 'published', deletedAt: null, categoryId: { in: ids } },
        select: { slug: true },
      });
      expect(expected.length).toBeGreaterThan(0);
      const r = await list('?category=phong-khach&pageSize=100');
      expect(slugs(r.items).sort()).toEqual(expected.map((e) => e.slug).sort());
      expect(r.meta.total).toBe(expected.length);
      // có cả sản phẩm của danh mục con (không chỉ của danh mục cha)
      expect(r.items.some((i) => kids.some((k) => k.id === i.categoryId))).toBe(true);

      const leaf = await list('?category=ban-tra&pageSize=100');
      const leafCat = await prisma.category.findFirstOrThrow({ where: { slug: 'ban-tra' } });
      expect(leaf.items.length).toBeGreaterThan(0);
      expect(leaf.items.every((i) => i.categoryId === leafCat.id)).toBe(true);
      expect(leaf.items.length).toBeLessThan(r.items.length);
    });

    it('lọc theo giá (min gồm, max loại trừ), thương hiệu, có mô hình 3D, nổi bật, màu; kết hợp nhiều bộ lọc', async () => {
      const prices = all.map(eff).sort((a, b) => a - b);
      const lo = prices[Math.floor(prices.length / 3)];
      const hi = prices[Math.floor((prices.length * 2) / 3)];
      expect(hi).toBeGreaterThan(lo);
      const byPrice = await list(`?minPrice=${lo}&maxPrice=${hi}&pageSize=100`);
      expect(slugs(byPrice.items).sort()).toEqual(
        slugs(all.filter((i) => eff(i) >= lo && eff(i) < hi)).sort(),
      );
      expect(byPrice.items.length).toBeGreaterThan(0);

      const brandId = all.find((i) => i.brandId)!.brandId!;
      const byBrand = await list(`?brand=${brandId}&pageSize=100`);
      expect(slugs(byBrand.items).sort()).toEqual(slugs(all.filter((i) => i.brandId === brandId)).sort());

      const dbHas3d = await prisma.product.count({
        where: { status: 'published', deletedAt: null, has3dModel: true },
      });
      const with3d = await list('?has3d=true&pageSize=100');
      expect(with3d.meta.total).toBe(dbHas3d);
      expect(with3d.items.every((i) => i.has3dModel)).toBe(true);
      const without3d = await list('?has3d=false&pageSize=100');
      expect(without3d.meta.total).toBe(all.length - dbHas3d);

      const featured = await list('?featured=true&pageSize=100');
      expect(featured.items.every((i) => i.isFeatured)).toBe(true);
      expect(featured.meta.total).toBe(all.filter((i) => i.isFeatured).length);

      const color = all.flatMap((i) => i.colors).find(Boolean)!.name;
      const byColor = await list(`?color=${encodeURIComponent(color)}&pageSize=100`);
      expect(slugs(byColor.items).sort()).toEqual(
        slugs(all.filter((i) => i.colors.some((c) => c.name === color))).sort(),
      );

      const combo = await list(`?category=phong-khach&has3d=true&minPrice=${lo}&pageSize=100`);
      const parent = await prisma.category.findFirstOrThrow({ where: { slug: 'phong-khach' } });
      const kidIds = (await prisma.category.findMany({ where: { parentId: parent.id } })).map((k) => k.id);
      expect(slugs(combo.items).sort()).toEqual(
        slugs(
          all.filter(
            (i) =>
              (i.categoryId === parent.id || kidIds.includes(i.categoryId ?? -1)) &&
              i.has3dModel &&
              eff(i) >= lo,
          ),
        ).sort(),
      );
    });

    it('sắp xếp: price:asc/desc, soldCount:desc, ratingAvg:desc, name:asc, createdAt:desc (mặc định)', async () => {
      const mono = <T>(xs: T[], dir: 'asc' | 'desc') =>
        xs.every((x, i) => i === 0 || (dir === 'asc' ? xs[i - 1] <= x : xs[i - 1] >= x));
      const sorted = async (sort: string) =>
        (await list(`?sort=${encodeURIComponent(sort)}&pageSize=100`)).items;
      expect(mono((await sorted('price:asc')).map(eff), 'asc')).toBe(true);
      expect(mono((await sorted('price:desc')).map(eff), 'desc')).toBe(true);
      expect(
        mono(
          (await sorted('soldCount:desc')).map((i) => i.soldCount),
          'desc',
        ),
      ).toBe(true);
      expect(
        mono(
          (await sorted('ratingAvg:desc')).map((i) => Number(i.ratingAvg)),
          'desc',
        ),
      ).toBe(true);
      expect(
        mono(
          (await sorted('name:asc')).map((i) => i.name),
          'asc',
        ),
      ).toBe(true);
      const def = (await list('?pageSize=100')).items;
      expect(
        mono(
          def.map((i) => i.createdAt),
          'desc',
        ),
      ).toBe(true);
      // sắp xếp chỉ đổi thứ tự, không đổi tập kết quả
      expect(slugs(await sorted('price:asc')).sort()).toEqual(slugs(all).sort());
      // đầu danh sách price:asc là sản phẩm rẻ nhất, price:desc là đắt nhất
      const prices = all.map(eff);
      expect(eff((await sorted('price:asc'))[0])).toBe(Math.min(...prices));
      expect(eff((await sorted('price:desc'))[0])).toBe(Math.max(...prices));
    });

    it('phân trang: các trang không trùng, ghép lại đúng; trang cuối lẻ; pageSize/page ngoài khoảng được kẹp', async () => {
      const full = await list('?sort=price:asc&pageSize=100');
      const total = full.meta.total;
      const size = 5;
      const pages = Math.ceil(total / size);
      const got: string[] = [];
      for (let p = 1; p <= pages; p++) {
        const r = await list(`?sort=price:asc&pageSize=${size}&page=${p}`);
        expect(r.meta).toMatchObject({ page: p, pageSize: size, total });
        expect(r.items.length).toBe(p < pages ? size : total - size * (pages - 1));
        got.push(...slugs(r.items));
      }
      expect(got).toEqual(slugs(full.items)); // thứ tự ổn định, không trùng, không sót
      // page vượt quá ⇒ kẹp về trang cuối; page 0/âm/chữ ⇒ trang 1
      expect((await list(`?pageSize=${size}&page=${pages + 50}`)).meta.page).toBe(pages);
      for (const bad of ['0', '-3', 'abc'])
        expect((await list(`?pageSize=${size}&page=${bad}`)).meta.page).toBe(1);
      // pageSize quá lớn bị kẹp 100, bằng 0 ⇒ 1
      expect((await list('?pageSize=1000')).meta.pageSize).toBe(100);
      expect((await list('?pageSize=0')).meta.pageSize).toBe(1);
      expect((await list('')).meta.pageSize).toBe(12); // mặc định 12
    });

    it('không có kết quả ⇒ danh sách rỗng, total 0, vẫn 200', async () => {
      const r = await list('?category=phong-khach&minPrice=999999999999');
      expect(r.items).toEqual([]);
      expect(r.meta.total).toBe(0);
      const r2 = await list('?minPrice=500&maxPrice=100');
      expect(r2.items).toEqual([]);
    });

    it('tham số không hợp lệ không làm máy chủ lỗi (không 5xx) và giữ nguyên dạng phản hồi', async () => {
      for (const qs of [
        '?sort=xyz',
        '?sort=:asc',
        '?minPrice=abc',
        '?maxPrice=-5',
        '?has3d=maybe',
        '?pageSize=abc',
        '?page=0',
        '?page=-3',
      ]) {
        const r = await get(`/products${qs}`);
        expect(r.status).toBeLessThan(500);
        expect(r.body.success).toBe(true);
        expect(Array.isArray(r.body.data)).toBe(true);
      }
    });

    it('yêu cầu ĐẦU TIÊN sau khi xóa cache catalog vẫn sắp mới nhất trước (trước đây sai vì so sánh chuỗi Date)', async () => {
      const newestFirst = (xs: Item[]) =>
        xs.every((x, i) => i === 0 || new Date(xs[i - 1].createdAt) >= new Date(x.createdAt));
      await cache.invalidateCatalog();
      const cold = await list('?pageSize=100'); // lần dựng chỉ mục từ CSDL
      expect(newestFirst(cold.items)).toBe(true);
      expect(cold.items[0].slug).toBe(
        (
          await prisma.product.findFirstOrThrow({
            where: { status: 'published', deletedAt: null },
            orderBy: { createdAt: 'desc' },
          })
        ).slug,
      );
      await cache.invalidateCatalog();
      const coldExplicit = await list('?pageSize=100&sort=createdAt:desc');
      expect(newestFirst(coldExplicit.items)).toBe(true);
      await cache.invalidateCatalog();
      const coldAsc = await list('?pageSize=100&sort=createdAt:asc');
      expect(newestFirst([...coldAsc.items].reverse())).toBe(true);
      // lần đọc sau (từ cache) cho đúng cùng thứ tự
      expect(slugs((await list('?pageSize=100')).items)).toEqual(slugs(cold.items));
    });

    it('danh sách quản trị (sản phẩm, không gian) cũng sắp theo createdAt đúng thứ tự thời gian', async () => {
      const auth = (p: string) => http.get(`/api${p}`).set('Authorization', `Bearer ${admin}`);
      for (const [path, key] of [
        ['/admin/products?pageSize=100&sort=createdAt:desc', 'createdAt'],
        ['/admin/spaces?pageSize=100&sort=createdAt:desc', 'createdAt'],
      ] as const) {
        await cache.invalidateCatalog();
        const r = await auth(path);
        expect(r.status).toBe(200);
        const xs = r.body.data as Array<Record<string, string>>;
        expect(xs.length).toBeGreaterThan(3);
        expect(xs.every((x, i) => i === 0 || new Date(xs[i - 1][key]) >= new Date(x[key]))).toBe(true);
      }
    });

    it('sản phẩm bị ẩn (draft) không xuất hiện ở danh sách/tìm kiếm/chi tiết, khôi phục thì xuất hiện lại', async () => {
      const p = all[0];
      const row = await prisma.product.findFirstOrThrow({ where: { slug: p.slug } });
      const setStatus = async (status: 'draft' | 'published') => {
        await prisma.product.update({ where: { id: row.id }, data: { status } });
        await cache.invalidateCatalog(); // ghi trực tiếp CSDL nên phải xóa cache như khi admin lưu
      };
      await setStatus('draft');
      try {
        const r = await list('?pageSize=100');
        expect(slugs(r.items)).not.toContain(p.slug);
        expect(r.meta.total).toBe(all.length - 1);
        expect(slugs((await search(p.name)).items)).not.toContain(p.slug);
        expect((await get(`/products/${p.slug}`)).status).toBe(404);
      } finally {
        await setStatus('published');
      }
      expect(slugs((await list('?pageSize=100')).items)).toContain(p.slug);
    });
  });

  // ------------------------------------------------------------------ UC-CAT-03
  describe('UC-CAT-03 tìm kiếm sản phẩm', () => {
    it('tìm chính xác theo tên: sản phẩm khớp đứng đầu', async () => {
      const r = await search('Bàn trà lồng nhau');
      expect(r.items.length).toBeGreaterThan(0);
      expect(r.items[0].slug).toBe('ban-tra-long-nhau');
      expect(r.meta.total).toBe(r.items.length);
    });

    it('tìm một phần: mọi từ khóa đều phải có mặt (AND); từ nằm giữa tên cũng khớp', async () => {
      const r = await search('tròn');
      expect(slugs(r.items)).toContain('ban-tra-go-soi-tron');
      const two = await search('bàn trà');
      expect(slugs(two.items)).toEqual(
        expect.arrayContaining(['ban-tra-go-soi-tron', 'ban-tra-mat-da', 'ban-tra-long-nhau']),
      );
      const narrow = await search('bàn trà đá');
      expect(slugs(narrow.items)).toContain('ban-tra-mat-da');
      expect(narrow.items.length).toBeLessThanOrEqual(two.items.length);
      expect(slugs(two.items)).toEqual(expect.arrayContaining(slugs(narrow.items))); // thêm từ khóa chỉ thu hẹp (AND)
      const prefix = await search('ban tr');
      expect(slugs(prefix.items)).toEqual(
        expect.arrayContaining(slugs(two.items).filter((s) => s.startsWith('ban-tra'))),
      );
    });

    it('không tìm thấy ⇒ rỗng, total 0', async () => {
      const r = await search('zzzxxqqq không có sản phẩm này');
      expect(r.items).toEqual([]);
      expect(r.meta.total).toBe(0);
    });

    it('từ khóa rỗng/khoảng trắng không gây lỗi; ký tự đặc biệt được coi là chữ thường (không phải ký tự đại diện)', async () => {
      for (const q of ['', '   ']) {
        const r = await get(`/products/search?q=${encodeURIComponent(q)}`);
        expect(r.status).toBeLessThan(500);
        expect(r.body.success).toBe(true);
      }
      for (const q of [
        '%',
        '_',
        '%%',
        "'",
        '"; DROP TABLE products; --',
        '\\',
        '.*',
        '(',
        '[a-z]+',
        '<script>',
      ]) {
        const r = await search(q);
        // Không phải ký tự đại diện/regex: kết quả (nếu có) phải chứa ĐÚNG ký tự đó dạng chữ, và không khớp mọi thứ.
        // (Các spec khác có thể để lại dữ liệu có ký tự như "(" trong tên danh mục, nên không đòi rỗng tuyệt đối.)
        const text = (x: Item) => foldVi([x.name, x.category?.name, x.shortDescription ?? ''].join(' '));
        const terms = foldVi(q).split(/\s+/).filter(Boolean);
        expect(r.items.every((x) => terms.every((t) => text(x).includes(t)))).toBe(true);
        expect(r.meta.total).toBeLessThan(all.length);
      }
      // bảng sản phẩm vẫn nguyên
      expect(await prisma.product.count({ where: { status: 'published', deletedAt: null } })).toBe(
        all.length,
      );
    });

    it('phân trang kết quả tìm kiếm; q kết hợp với bộ lọc ở /products; không đổi kết quả danh sách thường', async () => {
      const full = await search('bàn', '&pageSize=100');
      expect(full.meta.total).toBeGreaterThan(3);
      const p1 = await search('bàn', '&pageSize=2&page=1');
      const p2 = await search('bàn', '&pageSize=2&page=2');
      expect(p1.meta).toMatchObject({ page: 1, pageSize: 2, total: full.meta.total });
      expect(slugs(p1.items)).toEqual(slugs(full.items).slice(0, 2));
      expect(slugs(p2.items)).toEqual(slugs(full.items).slice(2, 4));
      // GET /products?q= cho cùng tập kết quả (khác nhau ở thứ tự mặc định)
      const viaList = await list('?q=b%C3%A0n&pageSize=100');
      expect(slugs(viaList.items).sort()).toEqual(slugs(full.items).sort());
      // danh sách thường không bị ảnh hưởng sau các lần tìm kiếm
      expect((await list('?pageSize=100')).meta.total).toBe(all.length);
      expect(slugs((await list('?pageSize=100')).items)).toEqual(slugs(all));
    });
  });

  // ------------------------------------------------------------------ UC-CAT-06
  describe('UC-CAT-06 tìm kiếm không dấu', () => {
    it('có dấu, không dấu, hoa/thường cho CÙNG một tập kết quả và cùng thứ tự', async () => {
      const ref = await search('Bàn trà');
      expect(ref.items.length).toBeGreaterThanOrEqual(3);
      for (const q of ['ban tra', 'BAN TRA', 'bAn TrÀ', 'BÀN TRÀ', 'bàn  trà', '  ban tra  ']) {
        const r = await search(q);
        expect(slugs(r.items)).toEqual(slugs(ref.items));
        expect(r.meta.total).toBe(ref.meta.total);
      }
    });

    it('chữ Đ/đ được xử lý: "den tran" tìm ra "Đèn trang trí", "đèn" và "DEN" như nhau', async () => {
      const a = await search('den tran');
      expect(slugs(a.items)).toContain('den-trang-tri');
      const plain = await search('den trang');
      expect(slugs(plain.items)).toContain('den-trang-tri');
      expect(slugs((await search('đèn trang')).items)).toEqual(slugs(plain.items));
      expect(slugs((await search('ĐÈN TRANG')).items)).toEqual(slugs(plain.items));
      expect(slugs((await search('DEN TRANG')).items)).toEqual(slugs(plain.items));
    });

    it('mọi tên sản phẩm trong CSDL tìm lại được bằng bản không dấu của chính nó (kết quả chứa sản phẩm đó)', async () => {
      const sample = all.filter((_, i) => i % 4 === 0);
      for (const p of sample) {
        const q = foldVi(p.name);
        const r = await search(q, '&pageSize=100');
        expect(slugs(r.items)).toContain(p.slug);
      }
    });

    it('không có kết quả khi từ khóa không dấu không khớp; tìm có dấu "sai dấu" vẫn khớp bản không dấu', async () => {
      expect((await search('xyzw qqqq')).items).toEqual([]);
      const wrongTone = await search('bản trá'); // dấu sai nhưng cùng chữ gốc
      expect(slugs(wrongTone.items)).toContain('ban-tra-long-nhau');
    });

    it('tìm không dấu không làm đổi danh sách thường và kết quả tìm có dấu', async () => {
      const before = slugs((await search('Sofa')).items);
      await search('sofa');
      await search('SOFA');
      expect(slugs((await search('Sofa')).items)).toEqual(before);
      expect(slugs((await list('?pageSize=100')).items)).toEqual(slugs(all));
    });
  });

  // ------------------------------------------------------------------ Quyết định chủ dự án (2026-11-09): 404 danh mục, q < 2 ký tự
  describe('danh mục không tồn tại / không hoạt động ⇒ 404; từ khóa 1 ký tự ⇒ rỗng; cache không làm kết quả cũ', () => {
    const errCode = (r: { body: { error?: { code?: string } } }) => r.body.error?.code;

    it('slug danh mục không tồn tại ⇒ 404 ở danh sách, tìm kiếm và facets (không trả toàn bộ sản phẩm)', async () => {
      for (const path of [
        '/products?category=khong-ton-tai-xyz',
        '/products/search?q=ban&category=khong-ton-tai-xyz',
        '/products/facets?category=khong-ton-tai-xyz',
        '/products?category=%25',
        '/products?category=phong-khach&category=khong-ton-tai-xyz', // một slug sai trong nhiều slug
      ]) {
        const r = await get(path);
        expect(r.status).toBe(404);
        expect(r.body.success).toBe(false);
        expect(errCode(r)).toBe('RESOURCE_NOT_FOUND');
      }
      // slug hợp lệ vẫn 200, không bị ảnh hưởng
      expect((await get('/products?category=phong-khach')).status).toBe(200);
    });

    it('danh mục không hoạt động (isActive=false) ⇒ 404; danh mục con không hoạt động bị loại khỏi danh mục cha; bật lại thì hoạt động', async () => {
      const parent = await prisma.category.findFirstOrThrow({ where: { slug: 'phong-khach' } });
      const child = await prisma.category.findFirstOrThrow({
        where: { slug: 'ban-tra', parentId: parent.id },
      });
      const before = await list('?category=phong-khach&pageSize=100');
      const childCount = (await list('?category=ban-tra&pageSize=100')).meta.total;
      expect(childCount).toBeGreaterThan(0);
      try {
        await prisma.category.update({ where: { id: child.id }, data: { isActive: false } });
        await cache.invalidateCatalog(); // admin đổi danh mục luôn xóa cache catalog
        expect((await get('/products?category=ban-tra')).status).toBe(404);
        const afterChild = await list('?category=phong-khach&pageSize=100');
        expect(afterChild.meta.total).toBe(before.meta.total - childCount);
        await prisma.category.update({ where: { id: parent.id }, data: { isActive: false } });
        await cache.invalidateCatalog();
        expect((await get('/products?category=phong-khach')).status).toBe(404);
        expect((await get('/products/search?q=ban&category=phong-khach')).status).toBe(404);
      } finally {
        await prisma.category.updateMany({
          where: { id: { in: [parent.id, child.id] } },
          data: { isActive: true },
        });
        await cache.invalidateCatalog();
      }
      expect((await list('?category=phong-khach&pageSize=100')).meta.total).toBe(before.meta.total);
    });

    it('từ khóa 1 ký tự ⇒ rỗng (200, total 0) ở tìm kiếm và danh sách; không có từ khóa hoặc ≥ 2 ký tự ⇒ bình thường', async () => {
      for (const q of ['a', 'b', 'đ', ' a ', '%', 'Đ']) {
        const r = await search(q);
        expect(r.items).toEqual([]);
        expect(r.meta.total).toBe(0);
        const l = await list(`?q=${encodeURIComponent(q)}`);
        expect(l.items).toEqual([]);
        expect(l.meta.total).toBe(0);
      }
      // 1 ký tự kết hợp bộ lọc vẫn rỗng
      expect((await list('?q=a&category=phong-khach')).meta.total).toBe(0);
      // không có q hoặc q toàn khoảng trắng ⇒ danh sách bình thường
      expect((await search('')).meta.total).toBe(all.length);
      expect((await search('   ')).meta.total).toBe(all.length);
      expect((await get('/products/search')).body.meta.total).toBe(all.length);
      // đúng 2 ký tự ⇒ tìm bình thường
      const two = await search('ba');
      expect(two.meta.total).toBeGreaterThan(0);
      expect(
        two.items.every((x) =>
          foldVi(JSON.stringify([x.name, x.category?.name, x.shortDescription])).includes('ba'),
        ),
      ).toBe(true);
    });

    it('kết hợp danh mục + từ khóa + giá + sắp xếp + phân trang cho kết quả nhất quán', async () => {
      const base = await list('?category=phong-khach&pageSize=100');
      const q = foldVi(base.items[0].name).split(' ')[0];
      const r = await list(
        `?category=phong-khach&q=${encodeURIComponent(q)}&sort=price:asc&pageSize=2&page=1`,
      );
      expect(r.items.length).toBeLessThanOrEqual(2);
      expect(r.meta.pageSize).toBe(2);
      const full = await list(`?category=phong-khach&q=${encodeURIComponent(q)}&sort=price:asc&pageSize=100`);
      expect(slugs(r.items)).toEqual(slugs(full.items.slice(0, 2)));
      expect(full.items.every((x, i) => i === 0 || eff(full.items[i - 1]) <= eff(x))).toBe(true);
      const page2 = await list(
        `?category=phong-khach&q=${encodeURIComponent(q)}&sort=price:asc&pageSize=2&page=2`,
      );
      expect(slugs(page2.items)).toEqual(slugs(full.items.slice(2, 4)));
    });

    it('không có bộ lọc hasAr (AR đã bị loại bỏ): tham số lạ bị bỏ qua', async () => {
      expect((await list('?hasAr=true&pageSize=100')).meta.total).toBe(all.length);
    });

    it('sửa sản phẩm qua admin: danh sách và tìm kiếm thấy ngay (cache bị xóa), kể cả sau khi sản phẩm ẩn', async () => {
      const p = all[1];
      const row = await prisma.product.findFirstOrThrow({ where: { slug: p.slug } });
      const newName = `Ghế thử nghiệm cache ${Date.now()}`;
      try {
        // mồi cache bằng một lần đọc
        expect((await search(p.name)).items.some((x) => x.slug === p.slug)).toBe(true);
        await prisma.product.update({ where: { id: row.id }, data: { name: newName } });
        await cache.invalidateCatalog();
        expect((await search(newName)).items.map((x) => x.slug)).toContain(p.slug);
        expect((await search(p.name)).items.map((x) => x.slug)).not.toContain(p.slug);
      } finally {
        await prisma.product.update({ where: { id: row.id }, data: { name: p.name } });
        await cache.invalidateCatalog();
      }
      expect((await search(p.name)).items.map((x) => x.slug)).toContain(p.slug);
    });
  });

  // ------------------------------------------------------------------ Quyết định đã chốt: giữ cơ chế hiện tại (ghi ở DECISIONS D-T51)
  // - tham số sai (sort lạ, page < 1) ⇒ lùi về mặc định, không 400; sort theo quy ước field:dir; pageSize ≤ 100
  // - tìm kiếm lọc trong bộ nhớ bằng foldVi (không dùng $queryRaw/trigram)
});
