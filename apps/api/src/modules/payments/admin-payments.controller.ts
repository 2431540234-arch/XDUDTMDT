// M10 – Thanh toán và vận chuyển. Thanh toán (VNPay sandbox), IPN, xác nhận chuyển khoản, hoàn tiền thủ công
// Controller – UC-ADM-23, 24
// Bảng: payments
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – payments')
@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentsController {}
