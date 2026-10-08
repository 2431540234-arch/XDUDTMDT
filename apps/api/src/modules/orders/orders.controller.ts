// M09 – Đơn hàng. Đặt hàng, theo dõi, hủy, quản trị đơn
// Controller – UC-ORD-01, 02, 03
// Bảng: orders, order_items, order_status_history
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {}
