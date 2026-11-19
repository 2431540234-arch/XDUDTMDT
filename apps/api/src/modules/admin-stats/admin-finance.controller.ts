// Báo cáo doanh thu: /admin/stats/finance. Chỉ role admin. Đọc orders, order_items, order_status_history
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminFinanceService } from './admin-finance.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – doanh thu')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('view_orders')
@Controller('admin')
export class AdminFinanceController {
  constructor(private readonly finance: AdminFinanceService) {}

  @Get('stats/finance')
  @ApiOperation({
    summary: 'Báo cáo doanh thu (from, to = YYYY-MM-DD). Doanh thu = đơn giao thành công theo ngày giao',
  })
  report(@Query() q: RawQuery) {
    return this.finance.report(q);
  }
}
