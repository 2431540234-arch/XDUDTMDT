import type Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';
import { CacheService } from './cache.service';

/** Redis giả trong bộ nhớ, chỉ có các lệnh CacheService dùng. */
class FakeRedis {
  store = new Map<string, string>();
  ttl = new Map<string, number>();
  failNext = false;

  private check() {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('redis down');
    }
  }
  async get(k: string) {
    this.check();
    return this.store.get(k) ?? null;
  }
  async set(k: string, v: string, _ex: string, ttl: number) {
    this.check();
    this.store.set(k, v);
    this.ttl.set(k, ttl);
    return 'OK';
  }
  async del(...ks: string[]) {
    this.check();
    return ks.filter((k) => this.store.delete(k)).length;
  }
  async scan(_cursor: string, _m: string, pattern: string) {
    this.check();
    const prefix = pattern.replace(/\*$/, '');
    return ['0', [...this.store.keys()].filter((k) => k.startsWith(prefix))] as [string, string[]];
  }
  async ping() {
    return 'PONG';
  }
  disconnect() {}
}

function make(over: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    CACHE_ENABLED: true,
    CACHE_KEY_PREFIX: 'test:',
    CACHE_DEFAULT_TTL_SECONDS: 300,
    ...over,
  };
  const redis = new FakeRedis();
  const service = new CacheService(
    { get: (k: string) => values[k] } as unknown as AppConfig,
    redis as unknown as Redis,
  );
  return { redis, service };
}

describe('CacheService', () => {
  it('set rồi get trả lại đúng giá trị (JSON), khóa có tiền tố, TTL mặc định lấy từ cấu hình', async () => {
    const { service, redis } = make();
    await service.set('categories:tree', { a: [1, 2] });
    expect(redis.store.has('test:categories:tree')).toBe(true);
    expect(redis.ttl.get('test:categories:tree')).toBe(300);
    await expect(service.get('categories:tree')).resolves.toEqual({ a: [1, 2] });
  });

  it('set với TTL riêng', async () => {
    const { service, redis } = make();
    await service.set('k', 1, 60);
    expect(redis.ttl.get('test:k')).toBe(60);
  });

  it('get khóa không có trả null', async () => {
    const { service } = make();
    await expect(service.get('khong-co')).resolves.toBeNull();
  });

  it('del xóa nhiều khóa', async () => {
    const { service } = make();
    await service.set('a', 1);
    await service.set('b', 2);
    await service.del('a', 'b');
    await expect(service.get('a')).resolves.toBeNull();
    await expect(service.get('b')).resolves.toBeNull();
  });

  it('delByPrefix chỉ xóa khóa cùng tiền tố và trả về số khóa đã xóa', async () => {
    const { service } = make();
    await service.set('products:1', 1);
    await service.set('products:2', 2);
    await service.set('categories:tree', 3);
    await expect(service.delByPrefix('products:')).resolves.toBe(2);
    await expect(service.get('products:1')).resolves.toBeNull();
    await expect(service.get('categories:tree')).resolves.toBe(3);
  });

  it('getOrSet chỉ gọi loader một lần khi đã có cache', async () => {
    const { service } = make();
    const loader = jest.fn().mockResolvedValue({ x: 1 });
    await service.getOrSet('k', loader);
    await service.getOrSet('k', loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('CACHE_ENABLED=false: get luôn null, set/del không ghi gì', async () => {
    const { service, redis } = make({ CACHE_ENABLED: false });
    await service.set('k', 1);
    expect(redis.store.size).toBe(0);
    await expect(service.get('k')).resolves.toBeNull();
    const loader = jest.fn().mockResolvedValue(5);
    await service.getOrSet('k', loader);
    await service.getOrSet('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('lỗi Redis không làm hỏng request: get trả null, set/del không ném', async () => {
    const { service, redis } = make();
    redis.failNext = true;
    await expect(service.get('k')).resolves.toBeNull();
    redis.failNext = true;
    await expect(service.set('k', 1)).resolves.toBeUndefined();
    redis.failNext = true;
    await expect(service.del('k')).resolves.toBeUndefined();
  });
});
