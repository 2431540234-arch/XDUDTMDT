import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

// ValidationPipe được gắn trong app.setup.ts (cần cho cả app thật lẫn test e2e).
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthCoreModule,
    StorageModule,
    MailModule,
    ActivityLogModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // Thứ tự quan trọng: xác thực trước, phân quyền sau
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
