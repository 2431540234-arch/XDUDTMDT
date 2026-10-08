// M09 – Đơn hàng. Đặt hàng, theo dõi, hủy, quản trị đơn
// Controller – UC-ADM-20, 21, 22
// Bảng: orders, order_items, order_status_history
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – orders')
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {}
