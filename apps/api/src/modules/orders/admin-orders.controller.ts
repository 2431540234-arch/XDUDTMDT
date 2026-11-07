// UC-ADM-20..22 – Quản trị đơn hàng: /admin/orders (chỉ role admin). Bảng: orders, order_items, order_status_history
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminOrdersService } from './admin-orders.service';

@ApiTags('Admin – orders')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn (status=a,b, paymentStatus, from, to, q, sort, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.orders.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo đơn hộ khách: { userId, paymentMethod, note?, items:[{variantId, quantity}] }',
  })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.orders.create(adminId, body);
  }

  @Get('counts')
  counts() {
    return this.orders.counts();
  }

  @Get(':code/invoice')
  @ApiOperation({ summary: 'Dữ liệu in hóa đơn (cửa hàng + đơn)' })
  invoice(@Param('code') code: string) {
    return this.orders.invoice(code);
  }

  @Get(':code')
  detail(@Param('code') code: string) {
    return this.orders.detail(code);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Chuyển trạng thái đúng thứ tự: { status, note? } (sai thứ tự ⇒ 409)' })
  setStatus(@CurrentUser('id') adminId: number, @Param('id') id: string, @Body() body: unknown) {
    return this.orders.setStatus(adminId, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser('id') adminId: number, @Param('id') id: string, @Body() body: unknown) {
    return this.orders.cancel(adminId, id, body);
  }

  @Post(':id/refund')
  @HttpCode(200)
  refund(@CurrentUser('id') adminId: number, @Param('id') id: string) {
    return this.orders.refund(adminId, id);
  }

  @Patch(':id/note')
  note(@CurrentUser('id') adminId: number, @Param('id') id: string, @Body() body: unknown) {
    return this.orders.saveNote(adminId, id, body);
  }
}
