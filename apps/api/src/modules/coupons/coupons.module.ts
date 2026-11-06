// M08 – Giỏ hàng và mã giảm giá. Mã giảm giá (xem trước khi áp, quản trị)
// Module – UC-CART-04 (xem trước); UC-ADM-19
// Bảng: coupons, coupon_usages
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { AdminCouponsController } from './admin-coupons.controller';
import { AdminCouponsService } from './admin-coupons.service';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService, AdminCouponsService],
  exports: [CouponsService, AdminCouponsService],
})
export class CouponsModule {}
