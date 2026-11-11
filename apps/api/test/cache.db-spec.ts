// E2E (supertest) cache Redis công khai (D-T30, D-P14) trên aurelia_test: hit/miss, admin sửa thì lần đọc sau thấy dữ liệu mới,
// không cache dữ liệu theo người dùng, Redis lỗi vẫn trả dữ liệu. Cần Redis. Mỗi test tự tạo dữ liệu riêng.
// Cách chứng minh "hit": sửa thẳng DB (bỏ qua service) rồi đọc lại ⇒ vẫn ra giá trị cũ; sửa qua API admin ⇒ ra giá trị mới.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CACHE_KEYS, CACHE_TTL } from '../src/cache/catalog-cache';
import { CacheService } from '../src/cache/cache.service';

describe('Cache Redis công khai (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let cache: CacheService;
  const prisma = new PrismaClient();
  const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT ?? 6379) });
  let admin = '';
  let cust = '';
  let seq = 0;

  const api = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    token?: string,
    body?: object,
  ) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) =>
    (await api('post', '/auth/login', undefined, { email, password, adminOnly })).body.data.tokens
      .accessToken as string;
  const cached = <T>(key: string) => cache.get<T>(key);
  const uniq = () => `${Date.now()}-${++seq}`;

  /** Sản phẩm đã đăng thuộc một danh mục riêng, có một biến thể */
  async function newProduct() {
    const n = uniq();
    const category = await prisma.category.create({
      data: { name: `Danh mục cache ${n}`, slug: `dm-cache-${n}` },
    });
    const product = await prisma.product.create({
      data: {
        name: `Sản phẩm cache ${n}`,
        slug: `sp-cache-${n}`,
        status: 'published',
        categoryId: category.id,
      },
    });
    await prisma.productVariant.create({
      data: { productId: product.id, sku: `CACHE-${n}`, price: 1_000_000, stockQuantity: 5 },
    });
    return { category, product };
  }

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    cache = app.get(CacheService);
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
  });

  afterAll(async () => {
    redis.disconnect();
    await prisma.$disconnect();
    await app?.close();
  });

  it('TTL theo D-T30', () => {
    expect(CACHE_TTL).toMatchObject({
      categoriesTree: 600,
      productsFeatured: 120,
      settingsPublic: 600,
      page: 600,
      product: 60,
    });
    expect(CACHE_KEYS.categoriesTree).toBe('categories:tree');
    expect(CACHE_KEYS.settingsPublic).toBe('settings:public');
    expect(CACHE_KEYS.page('gioi-thieu')).toBe('pages:gioi-thieu');
    expect(CACHE_KEYS.product('ghe')).toBe('products:ghe');
  });

  it('chi tiết sản phẩm: miss ⇒ ghi cache; hit ⇒ không đọc DB; admin đổi danh mục ⇒ lần đọc sau thấy tên mới', async () => {
    const { category, product } = await newProduct();
    expect(await cached(`products:${product.slug}`)).toBeNull(); // chưa có
    const first = await api('get', `/products/${product.slug}`);
    expect(first.status).toBe(200);
    expect(first.body.data.breadcrumb.at(-1).label).toBe(category.name);
    const ttl = await redis.ttl(`${process.env.CACHE_KEY_PREFIX}products:${product.slug}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    expect(await cached(`products:${product.slug}`)).not.toBeNull(); // đã vào cache

    // sửa thẳng DB (bỏ qua service) ⇒ vẫn thấy dữ liệu cũ = đang phục vụ từ cache
    await prisma.category.update({ where: { id: category.id }, data: { name: 'Tên đổi thẳng DB' } });
    expect((await api('get', `/products/${product.slug}`)).body.data.breadcrumb.at(-1).label).toBe(
      category.name,
    );

    // sửa qua API admin ⇒ cache bị xóa ⇒ đọc lại thấy tên mới
    const patch = await api('patch', `/admin/categories/${category.id}`, admin, {
      name: 'Tên đổi qua admin',
    });
    expect(patch.status).toBe(200);
    expect(await cached(`products:${product.slug}`)).toBeNull();
    const after = await api('get', `/products/${product.slug}`);
    expect(after.body.data.breadcrumb.at(-1).label).toBe('Tên đổi qua admin');
  });

  it('cây danh mục: cache 10 phút, admin sửa thì có dữ liệu mới', async () => {
    const { category } = await newProduct();
    const find = (nodes: Array<{ id: number; name: string; children: unknown[] }>): string | undefined => {
      for (const n of nodes) {
        if (n.id === category.id) return n.name;
        const r = find(n.children as never);
        if (r) return r;
      }
    };
    const tree1 = await api('get', '/categories');
    expect(find(tree1.body.data)).toBe(category.name);
    expect(await cached(CACHE_KEYS.categoriesTree)).not.toBeNull();
    const ttl = await redis.ttl(`${process.env.CACHE_KEY_PREFIX}categories:tree`);
    expect(ttl).toBeGreaterThan(60);
    await prisma.category.update({ where: { id: category.id }, data: { name: 'Đổi thẳng DB (chưa thấy)' } });
    expect(find((await api('get', '/categories')).body.data)).toBe(category.name); // hit
    await api('patch', `/admin/categories/${category.id}`, admin, { name: 'Đổi qua admin (thấy ngay)' });
    expect(find((await api('get', '/categories')).body.data)).toBe('Đổi qua admin (thấy ngay)');
  });

  it('cài đặt công khai: cache; admin sửa cài đặt cửa hàng thì GET /settings/public thấy ngay', async () => {
    const before = await api('get', '/settings/public');
    expect(before.status).toBe(200);
    expect(await cached(CACHE_KEYS.settingsPublic)).not.toBeNull();
    const original = (await api('get', '/admin/settings', admin)).body.data;
    const name = `Cửa hàng cache ${uniq()}`;
    const setting = await prisma.setting.findUniqueOrThrow({ where: { key: 'store' } });
    // đổi thẳng DB ⇒ cache vẫn cũ
    await prisma.setting.update({
      where: { key: 'store' },
      data: { value: { ...(setting.value as object), name: 'Đổi thẳng DB' } },
    });
    expect((await api('get', '/settings/public')).body.data.store.name).toBe(before.body.data.store.name);
    const put = await api('put', '/admin/settings/store', admin, { store: { ...original.store, name } });
    expect(put.status).toBe(200);
    expect(await cached(CACHE_KEYS.settingsPublic)).toBeNull();
    expect((await api('get', '/settings/public')).body.data.store.name).toBe(name);
    await api('put', '/admin/settings/store', admin, { store: original.store }); // trả lại
  });

  it('trang tĩnh: cache theo slug; admin sửa/xóa trang thì xóa cache; 404 không bị cache', async () => {
    const n = uniq();
    const page = await prisma.page.create({
      data: {
        title: `Trang cache ${n}`,
        slug: `trang-cache-${n}`,
        content: 'Nội dung',
        status: 'published',
        type: 'static',
      },
    });
    expect((await api('get', '/pages/khong-co-trang-nay')).status).toBe(404);
    expect(await cached('pages:khong-co-trang-nay')).toBeNull();

    const r1 = await api('get', `/pages/${page.slug}`);
    expect(r1.body.data.title).toBe(page.title);
    expect(await cached(`pages:${page.slug}`)).not.toBeNull();
    await prisma.page.update({ where: { id: page.id }, data: { title: 'Đổi thẳng DB' } });
    expect((await api('get', `/pages/${page.slug}`)).body.data.title).toBe(page.title); // hit
    const patch = await api('patch', `/admin/pages/${page.id}`, admin, { title: 'Đổi qua admin' });
    expect(patch.status).toBe(200);
    expect(await cached(`pages:${page.slug}`)).toBeNull();
    expect((await api('get', `/pages/${page.slug}`)).body.data.title).toBe('Đổi qua admin');
    expect((await api('delete', `/admin/pages/${page.id}`, admin)).status).toBe(200);
    expect((await api('get', `/pages/${page.slug}`)).status).toBe(404);
  });

  it('không cache dữ liệu theo người dùng: cờ yêu thích tính riêng từng người; không có khóa giỏ/đơn/yêu thích trong Redis', async () => {
    const { product } = await newProduct();
    expect((await api('get', `/products/${product.slug}`, cust)).body.data.isWishlisted).toBe(false);
    expect((await api('put', `/wishlist/${product.slug}`, cust)).status).toBeLessThan(300);
    const mine = await api('get', `/products/${product.slug}`, cust);
    const anon = await api('get', `/products/${product.slug}`);
    expect(mine.body.data.isWishlisted).toBe(true); // lấy từ cache chung rồi gắn cờ theo người dùng
    expect(anon.body.data.isWishlisted).toBe(false);
    await api('get', '/cart', cust);
    await api('get', '/orders', cust);
    await api('get', '/wishlist', cust);
    const keys = await redis.keys(`${process.env.CACHE_KEY_PREFIX}*`);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      const bare = k.slice(String(process.env.CACHE_KEY_PREFIX).length);
      expect(bare).toMatch(/^(products|categories|settings|pages|catalog):/); // chỉ dữ liệu công khai
      expect(bare).not.toMatch(/cart|order|wishlist|user/);
    }
  });

  it('danh sách nổi bật cache 2 phút; sản phẩm mới được thêm qua API admin thì danh sách thấy ngay', async () => {
    const q = '/products?featured=true&pageSize=50';
    const a = await api('get', q);
    expect(a.status).toBe(200);
    const featuredKeys = (await redis.keys(`${process.env.CACHE_KEY_PREFIX}products:featured:*`)).length;
    expect(featuredKeys).toBeGreaterThanOrEqual(1);
    const { product } = await newProduct();
    await prisma.product.update({ where: { id: product.id }, data: { isFeatured: true } });
    const stale = await api('get', q);
    expect(stale.body.data.some((p: { slug: string }) => p.slug === product.slug)).toBe(false); // hit: chưa thấy
    // admin đổi một danh mục ⇒ xóa cache catalog ⇒ danh sách nổi bật dựng lại
    const { category } = await newProduct();
    await api('patch', `/admin/categories/${category.id}`, admin, { name: 'kích hoạt xóa cache' });
    const fresh = await api('get', q);
    expect(fresh.body.data.some((p: { slug: string }) => p.slug === product.slug)).toBe(true);
  });

  it('Redis lỗi ⇒ request vẫn trả đủ dữ liệu (coi như cache miss), thao tác ghi của admin vẫn thành công', async () => {
    const { category, product } = await newProduct();
    const redisClient = (cache as unknown as { redis: Redis }).redis;
    const spies = ['get', 'set', 'del', 'scan'].map((m) =>
      jest.spyOn(redisClient as never, m as never).mockRejectedValue(new Error('Redis down (test)') as never),
    );
    try {
      const detail = await api('get', `/products/${product.slug}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.name).toBe(product.name);
      expect((await api('get', '/categories')).status).toBe(200);
      expect((await api('get', '/settings/public')).status).toBe(200);
      expect((await api('get', '/products?featured=true')).status).toBe(200);
      expect((await api('get', '/products?q=cache')).status).toBe(200);
      // ghi qua admin khi Redis chết: vẫn 200, đọc lại ra dữ liệu mới (không có cache để cũ)
      const patch = await api('patch', `/admin/categories/${category.id}`, admin, {
        name: 'Đổi khi Redis chết',
      });
      expect(patch.status).toBe(200);
      expect((await api('get', `/products/${product.slug}`)).body.data.breadcrumb.at(-1).label).toBe(
        'Đổi khi Redis chết',
      );
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('khởi động API xóa cache của môi trường (không sống sót qua reset DB/seed)', async () => {
    await cache.set('products:khoa-cu', { x: 1 }, 60);
    expect(await cached('products:khoa-cu')).not.toBeNull();
    await cache.onApplicationBootstrap();
    expect(await cached('products:khoa-cu')).toBeNull();
  });
});
