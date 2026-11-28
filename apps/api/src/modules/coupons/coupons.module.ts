// M08 – Giỏ hàng và mã giảm giá. Mã giảm giá (xem trước khi áp, quản trị)
// Module – UC-CART-04 (xem trước, danh sách mã công khai); UC-ADM-19
// Bảng: coupons, coupon_usages
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module, forwardRef } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { AdminCouponsController } from './admin-coupons.controller';
import { AdminCouponsService } from './admin-coupons.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  // giỏ hàng dùng CouponsService, còn danh sách mã cần tổng tiền giỏ do CartService tính ⇒ hai module phụ thuộc vòng
  imports: [forwardRef(() => CartModule)],
  controllers: [AdminCouponsController, CouponsController],
  providers: [CouponsService, AdminCouponsService],
  exports: [CouponsService, AdminCouponsService],
})
export class CouponsModule {}
