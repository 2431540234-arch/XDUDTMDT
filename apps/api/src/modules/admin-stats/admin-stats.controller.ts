// UC-ADM – Thống kê admin: GET /admin/stats/overview (finance ở mốc 4)
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminStatsService } from './admin-stats.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – stats')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('view_orders')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Dashboard: KPI + so với kỳ trước, doanh thu theo ngày, trạng thái đơn, bán chạy, hoạt động (from, to = YYYY-MM-DD)',
  })
  overview(@Query() q: RawQuery) {
    return this.stats.overview(q);
  }
}
