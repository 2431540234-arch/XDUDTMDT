// M11 – Đơn hàng của tôi: /orders. Khách chỉ thấy đơn của chính mình (đơn người khác ⇒ 404). Bảng: orders, order_items
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Đặt hàng từ giỏ (giữ chỗ tồn kho trong transaction)' })
  @ApiBody({
    schema: { example: { addressId: 1, paymentMethod: 'cod', note: 'Giao giờ hành chính', itemIds: [12] } },
  })
  create(@CurrentUser('id') uid: number, @Body() body: unknown) {
    return this.orders.create(uid, body);
  }

  @Get()
  @ApiOperation({ summary: 'Đơn của tôi (lọc status=a,b; phân trang)' })
  async list(@CurrentUser('id') uid: number, @Query() q: RawQuery) {
    const r = await this.orders.list(uid, q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Get('counts')
  counts(@CurrentUser('id') uid: number) {
    return this.orders.counts(uid);
  }

  @Get(':code')
  detail(@CurrentUser('id') uid: number, @Param('code') code: string) {
    return this.orders.detail(uid, code);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Khách hủy đơn (pending|confirmed)' })
  cancel(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.orders.cancel(uid, id, body);
  }
}
