// Thu chi: /admin/stats/finance (báo cáo) và /admin/expenses (phiếu chi). Chỉ role admin. Bảng: expenses (+ đọc orders, payments)
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminFinanceService } from './admin-finance.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – thu chi')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('view_orders')
@Controller('admin')
export class AdminFinanceController {
  constructor(private readonly finance: AdminFinanceService) {}

  @Get('stats/finance')
  @ApiOperation({
    summary:
      'Báo cáo thu chi (from, to = YYYY-MM-DD). Doanh thu = đơn giao thành công theo ngày giao; hoàn tiền trừ qua phiếu chi refund',
  })
  report(@Query() q: RawQuery) {
    return this.finance.report(q);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Danh sách phiếu chi (category, from, to, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.finance.listExpenses(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @RequirePermission('process_orders')
  @Post('expenses')
  @ApiOperation({ summary: 'Thêm phiếu chi { category, amount, note, date }' })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.finance.createExpense(adminId, body);
  }

  @RequirePermission('process_orders')
  @Delete('expenses/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa phiếu chi nhập tay (phiếu hệ thống tự sinh không xóa được)' })
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.finance.removeExpense(adminId, id);
  }
}
