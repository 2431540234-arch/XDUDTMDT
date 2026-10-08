// M10 – Thanh toán và vận chuyển. Vận chuyển (admin nhập tay)
// Controller – UC-ADM-25
// Bảng: shipments
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – shipments')
@Roles('admin')
@Controller('admin/shipments')
export class AdminShipmentsController {}
