// M08 – Giỏ hàng và mã giảm giá. Mã giảm giá (xem trước khi áp, quản trị)
// Controller – UC-ADM-19
// Bảng: coupons, coupon_usages
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – coupons')
@Roles('admin')
@Controller('admin/coupons')
export class AdminCouponsController {}
