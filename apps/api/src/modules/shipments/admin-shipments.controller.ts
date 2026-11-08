// UC-ADM-25 – Vận chuyển (admin nhập tay): POST /admin/orders/:id/shipments, PATCH /admin/shipments/:id. Bảng: shipments
import { Body, Controller, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ShipmentsService } from './shipments.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – shipments')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('process_orders')
@Controller('admin')
export class AdminShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Post('orders/:id/shipments')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Tạo vận đơn { carrier: ghn|ghtk|viettel_post|other, trackingCode?, fee? } – chỉ khi đơn đang processing/shipping và chưa có vận đơn đang hoạt động',
  })
  create(@CurrentUser('id') adminId: number, @Param('id') id: string, @Body() body: unknown) {
    return this.shipments.create(adminId, id, body);
  }

  @Patch('shipments/:id')
  @ApiOperation({
    summary:
      'Cập nhật vận đơn { status?: picked_up|in_transit|delivered|failed|returned, carrier?, trackingCode?, fee? }. delivered ⇒ đơn tự hoàn tất',
  })
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.shipments.update(adminId, id, body);
  }
}
