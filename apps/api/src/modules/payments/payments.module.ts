// M10 – Thanh toán và vận chuyển. Thanh toán (VNPay sandbox), IPN, xác nhận chuyển khoản, hoàn tiền thủ công
// Module – UC-PAY-01, 02, 03; UC-ADM-23, 24
// Bảng: payments
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
