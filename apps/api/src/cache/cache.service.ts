// Cache Redis dùng chung (D-T30). Module nghiệp vụ gọi get/set/del/delByPrefix; chưa module nào dùng ở giai đoạn nền tảng.
// Cache chỉ là tối ưu: lỗi Redis không bao giờ làm hỏng request (ghi log rồi coi như cache miss).
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';

export const CACHE_REDIS = Symbol('CACHE_REDIS');

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly enabled: boolean;
  private readonly prefix: string;
  private readonly defaultTtl: number;

  constructor(
    config: AppConfig,
    @Inject(CACHE_REDIS) private readonly redis: Redis,
  ) {
    this.enabled = config.get('CACHE_ENABLED');
    this.prefix = config.get('CACHE_KEY_PREFIX');
    this.defaultTtl = config.get('CACHE_DEFAULT_TTL_SECONDS');
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  /** Giá trị đã lưu, hoặc null nếu không có/cache tắt/lỗi Redis. */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    try {
      const raw = await this.redis.get(this.k(key));
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (e) {
      this.logger.warn(`get "${key}" lỗi: ${(e as Error).message}`);
      return null;
    }
  }

  /** Lưu giá trị (JSON) với TTL giây (mặc định CACHE_DEFAULT_TTL_SECONDS). */
  async set(key: string, value: unknown, ttlSeconds: number = this.defaultTtl): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.redis.set(this.k(key), JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
      this.logger.warn(`set "${key}" lỗi: ${(e as Error).message}`);
    }
  }

  /** Xóa một hoặc nhiều khóa. */
  async del(...keys: string[]): Promise<void> {
    if (!this.enabled || keys.length === 0) return;
    try {
      await this.redis.del(...keys.map((k) => this.k(k)));
    } catch (e) {
      this.logger.warn(`del lỗi: ${(e as Error).message}`);
    }
  }

  /** Xóa mọi khóa bắt đầu bằng `prefix` (dùng khi admin sửa: ví dụ "categories:"). Trả về số khóa đã xóa. */
  async delByPrefix(prefix: string): Promise<number> {
    if (!this.enabled) return 0;
    let deleted = 0;
    try {
      let cursor = '0';
      do {
        // SCAN không chặn Redis (khác KEYS); xóa theo lô
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${this.k(prefix)}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length) deleted += await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (e) {
      this.logger.warn(`delByPrefix "${prefix}" lỗi: ${(e as Error).message}`);
    }
    return deleted;
  }

  /** Lấy từ cache; nếu chưa có thì gọi `loader`, lưu lại rồi trả về. */
  async getOrSet<T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
