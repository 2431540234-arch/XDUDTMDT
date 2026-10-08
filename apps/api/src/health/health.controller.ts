import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode, type HealthStatus } from '@aurelia-living/shared-types';
import { Public } from '../common/decorators/auth.decorators';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Kiểm tra API và kết nối cơ sở dữ liệu' })
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, 'Không kết nối được cơ sở dữ liệu.');
    }
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database: 'up' },
    };
  }
}
