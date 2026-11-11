import { CACHE_KEYS, CACHE_TTL, CatalogCache } from './catalog-cache';

function make() {
  const calls: string[] = [];
  const cache = {
    getOrSet: jest.fn(async (key: string, loader: () => Promise<unknown>, ttl: number) => {
      calls.push(`getOrSet ${key} ${ttl}`);
      return loader();
    }),
    del: jest.fn(async (...k: string[]) => void calls.push(`del ${k.join(',')}`)),
    delByPrefix: jest.fn(async (p: string) => {
      calls.push(`delByPrefix ${p}`);
      return 0;
    }),
  };
  return { svc: new CatalogCache(cache as never), calls };
}

describe('CatalogCache (D-T30)', () => {
  it('đọc dùng đúng khóa và TTL', async () => {
    const { svc, calls } = make();
    await svc.categoriesTree(async () => 1);
    await svc.settingsPublic(async () => 1);
    await svc.page('gioi-thieu', async () => 1);
    await svc.product('ghe', async () => 1);
    await svc.featured({ q: 1 }, async () => 1);
    expect(calls).toEqual([
      `getOrSet categories:tree ${CACHE_TTL.categoriesTree}`,
      `getOrSet settings:public ${CACHE_TTL.settingsPublic}`,
      `getOrSet pages:gioi-thieu ${CACHE_TTL.page}`,
      `getOrSet products:ghe ${CACHE_TTL.product}`,
      `getOrSet ${CACHE_KEYS.featured({ q: 1 })} ${CACHE_TTL.productsFeatured}`,
    ]);
    expect(CACHE_KEYS.featured({ q: 1 })).toMatch(/^products:featured:[0-9a-f]{16}$/);
    expect(CACHE_KEYS.featured({ q: 1 })).not.toBe(CACHE_KEYS.featured({ q: 2 }));
  });

  it('ghi xóa đúng nhóm khóa', async () => {
    const { svc, calls } = make();
    await svc.invalidateProducts();
    await svc.invalidateCatalog();
    await svc.invalidateSettings();
    await svc.invalidatePages();
    expect(calls).toEqual(
      expect.arrayContaining([
        'delByPrefix products:',
        'del catalog:index',
        'delByPrefix categories:',
        'del settings:public',
        'delByPrefix pages:',
      ]),
    );
  });
});
