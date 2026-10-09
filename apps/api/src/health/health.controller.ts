import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode, type CheckStatus, type HealthStatus } from '@aurelia-living/shared-types';
import { Public } from '../common/decorators/auth.decorators';
import { AppException } from '../common/exceptions/app.exception';
import { SmtpMailService } from '../mail/smtp-mail.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly smtp: SmtpMailService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Kiểm tra API, PostgreSQL, Redis, kho tệp (MinIO/S3), SMTP và hàng đợi' })
  async check(): Promise<HealthStatus> {
    const probe = async <T>(fn: () => Promise<T>): Promise<[CheckStatus, T | undefined]> => {
      try {
        return ['up', await fn()];
      } catch {
        return ['down', undefined];
      }
    };
    const [[database], [redis], [storage], [smtp], [queueStatus, queues]] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.jobs.pingRedis()),
      probe(() => this.storage.ping()),
      probe(() => this.smtp.verify()),
      probe(() => this.jobs.queueCounts()),
    ]);
    const checks = { database, redis, storage, smtp, queues: queueStatus };

    const down = Object.entries(checks)
      .filter(([, v]) => v === 'down')
      .map(([k]) => k);
    if (down.length) {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, `Không kết nối được: ${down.join(', ')}.`, {
        checks,
      });
    }
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
      queues: queues!,
    };
  }
}
