// M10 – Thanh toán và vận chuyển. Thanh toán (VNPay sandbox), IPN, xác nhận chuyển khoản, hoàn tiền thủ công
// Controller – UC-PAY-01, 02, 03
// Bảng: payments
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {}
