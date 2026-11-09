// UC-ADM-23, 24 – Xác nhận thanh toán thủ công (chuyển khoản): PATCH /admin/payments/:id/confirm. Bảng: payments
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminOrdersService } from '../orders/admin-orders.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – payments')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('process_orders')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  async list(@Query() q: RawQuery) {
    const r = await this.orders.listPayments(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  /** Xác nhận đã nhận tiền chuyển khoản; body tùy chọn { transactionCode } (duy nhất) */
  @Patch(':id/confirm')
  confirm(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.orders.confirmPayment(adminId, id, body);
  }

  /** Đánh dấu giao dịch chuyển khoản thất bại; body tùy chọn { reason } */
  @Patch(':id/fail')
  fail(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.orders.failPayment(adminId, id, body);
  }
}
