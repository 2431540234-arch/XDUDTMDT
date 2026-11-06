// M09 – Giỏ hàng: /cart. Mọi tổng tiền do server tính (không tin giá từ client). Bảng: carts, cart_items
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { CartService } from './cart.service';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Giỏ hàng (query items=1,2 để chỉ tính các dòng chọn; addressId để tính phí ship)',
  })
  get(@CurrentUser('id') uid: number, @Query() q: RawQuery) {
    return this.cart.getView(uid, q);
  }

  @Delete()
  clear(@CurrentUser('id') uid: number) {
    return this.cart.clear(uid);
  }

  @Post('items')
  @ApiOperation({ summary: 'Thêm biến thể vào giỏ: { variantId, quantity }' })
  add(@CurrentUser('id') uid: number, @Body() body: unknown) {
    return this.cart.addItem(uid, body);
  }

  @Patch('items/:id')
  update(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.cart.updateItem(uid, id, body);
  }

  @Delete('items/:id')
  remove(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number) {
    return this.cart.removeItem(uid, id);
  }

  @Post('coupon')
  @HttpCode(200)
  @ApiOperation({ summary: 'Áp mã giảm giá vào giỏ: { code }' })
  applyCoupon(@CurrentUser('id') uid: number, @Body() body: unknown) {
    return this.cart.applyCoupon(uid, body);
  }

  @Delete('coupon')
  removeCoupon(@CurrentUser('id') uid: number) {
    return this.cart.removeCoupon(uid);
  }
}
