// Bộ đếm Redis cho thanh toán VNPay: giới hạn số lượt tạo URL, số lần gọi querydr và mốc "khách quay về lần đầu".
// Dùng thẳng Redis (không qua CacheService) vì giới hạn vẫn phải có hiệu lực khi CACHE_ENABLED=false.
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { CACHE_REDIS } from '../../cache/cache.service';
import { AppConfig } from '../../config/app-config.service';

@Injectable()
export class VnpayGuard {
  private readonly logger = new Logger(VnpayGuard.name);

  constructor(
    private readonly config: AppConfig,
    @Inject(CACHE_REDIS) private readonly redis: Redis,
  ) {}

  private key(k: string) {
    return `${this.config.get('CACHE_KEY_PREFIX')}vnpay:${k}`;
  }

  /** Đếm trong cửa sổ 60 giây; trả true nếu lượt này còn trong hạn mức */
  private async hit(k: string, limit: number): Promise<boolean> {
    const key = this.key(k);
    // SET NX trước để khóa luôn có hạn (không có khóa đếm "sống mãi" nếu tiến trình chết giữa INCR và EXPIRE)
    await this.redis.set(key, '0', 'EX', 60, 'NX');
    return (await this.redis.incr(key)) <= limit;
  }

  /** Lượt tạo URL của một khách (tính chung checkout và retry). Redis lỗi ⇒ cho qua, vì vẫn còn rate limit toàn cục. */
  async allowUrl(userId: number): Promise<boolean> {
    try {
      return await this.hit(`url:${userId}`, this.config.get('VNPAY_URL_LIMIT_PER_MINUTE'));
    } catch (e) {
      this.logger.warn(`không đếm được lượt tạo URL: ${(e as Error).message}`);
      return true;
    }
  }

  /**
   * Được gọi querydr cho TxnRef này chưa: đã qua VNPAY_QUERYDR_DELAY_SECONDS kể từ lần đầu khách quay về, và chưa quá số lần/phút.
   * Redis lỗi ⇒ KHÔNG gọi (không có cách giới hạn thì không gọi ra ngoài).
   */
  async allowQuery(txnRef: string): Promise<boolean> {
    try {
      const seen = this.key(`seen:${txnRef}`);
      await this.redis.set(seen, String(Date.now()), 'EX', 3600, 'NX');
      const first = Number(await this.redis.get(seen));
      if (Date.now() - first < this.config.get('VNPAY_QUERYDR_DELAY_SECONDS') * 1000) return false;
      return await this.hit(`qdr:${txnRef}`, this.config.get('VNPAY_QUERYDR_LIMIT_PER_MINUTE'));
    } catch (e) {
      this.logger.warn(`không kiểm tra được hạn mức querydr: ${(e as Error).message}`);
      return false;
    }
  }
}
