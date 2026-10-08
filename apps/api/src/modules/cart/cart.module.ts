// M08 – Giỏ hàng và mã giảm giá. Giỏ hàng
// Module – UC-CART-01, 02, 03
// Bảng: carts, cart_items
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
