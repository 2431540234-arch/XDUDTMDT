import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode, type CheckStatus, type HealthStatus } from '@aurelia-living/shared-types';
import { Public } from '../common/decorators/auth.decorators';
import { AppException } from '../common/exceptions/app.exception';
import { JobsService } from '../modules/jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Kiểm tra API, PostgreSQL, Redis và kho tệp' })
  async check(): Promise<HealthStatus> {
    const probe = async (fn: () => Promise<unknown>): Promise<CheckStatus> => {
      try {
        await fn();
        return 'up';
      } catch {
        return 'down';
      }
    };
    const [database, redis, storage] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.jobs.pingRedis()),
      probe(() => this.storage.ping()),
    ]);
    const checks = { database, redis, storage };

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
    };
  }
}
