// M08 – Giỏ hàng và mã giảm giá. Giỏ hàng
// Controller – UC-CART-01, 02, 03
// Bảng: carts, cart_items
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('cart')
@Controller('cart')
export class CartController {}
