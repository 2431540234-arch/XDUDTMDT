import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';
import { CACHE_REDIS, CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_REDIS,
      inject: [AppConfig],
      // lazyConnect: không kết nối khi cache tắt hoặc chưa ai gọi; lỗi kết nối được CacheService nuốt và ghi log
      useFactory: (config: AppConfig) =>
        new Redis({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        }),
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
