// UC-ADM-23, 24 – Xác nhận thanh toán thủ công (chuyển khoản): PATCH /admin/payments/:id/confirm. Bảng: payments
import { Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AdminOrdersService } from '../orders/admin-orders.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – payments')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('process_orders')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Patch(':id/confirm')
  confirm(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.orders.confirmPayment(adminId, id);
  }
}
