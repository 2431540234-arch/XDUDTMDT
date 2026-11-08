// UC-ADM – Thống kê admin: GET /admin/stats/overview (finance ở mốc 4)
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminSpaceStatsService } from './admin-space-stats.service';
import { AdminStatsService } from './admin-stats.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – stats')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('view_orders')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly spaceStats: AdminSpaceStatsService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Dashboard: KPI + so với kỳ trước, doanh thu theo ngày, trạng thái đơn, bán chạy, hoạt động (from, to = YYYY-MM-DD)',
  })
  overview(@Query() q: RawQuery) {
    return this.stats.overview(q);
  }

  // Quyền ở mức hàm (RequirePermission) ghi đè quyền của cả controller (view_orders): phễu không gian thuộc quyền nội dung
  @Get('spaces')
  @RequirePermission('manage_content')
  @ApiOperation({
    summary:
      'Phễu không gian mẫu (from, to = YYYY-MM-DD): theo từng không gian lượt xem → bấm hotspot → thêm vào giỏ (gộp user và khách theo visitorId) + sản phẩm dẫn tới',
  })
  spaces(@Query() q: RawQuery) {
    return this.spaceStats.funnel(q);
  }
}
