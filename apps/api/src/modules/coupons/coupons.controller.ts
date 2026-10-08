// M08 – Giỏ hàng và mã giảm giá. Mã giảm giá (xem trước khi áp, quản trị)
// Controller – UC-CART-04 (xem trước)
// Bảng: coupons, coupon_usages
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {}
