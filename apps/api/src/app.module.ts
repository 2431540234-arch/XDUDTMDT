import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { AppConfig } from './config/app-config.service';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { FEATURE_MODULES } from './modules';
import { JobsModule } from './modules/jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

// ValidationPipe được gắn trong app.setup.ts (cần cho cả app thật lẫn test e2e).
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Giới hạn tốc độ dùng chung giữa các tiến trình nhờ lưu bộ đếm trong Redis (M02 siết chặt hơn bằng @Throttle)
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: config.get('REDIS_HOST'),
            port: config.get('REDIS_PORT'),
            keyPrefix: config.get('NODE_ENV') === 'test' ? 'throttle-test:' : 'throttle:',
          }),
        ),
      }),
    }),
    JobsModule,
    AuthCoreModule,
    StorageModule,
    MailModule,
    ActivityLogModule,
    HealthModule,
    ...FEATURE_MODULES,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // Thứ tự quan trọng: giới hạn tốc độ, xác thực, rồi phân quyền
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
