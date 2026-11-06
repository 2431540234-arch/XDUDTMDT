// M12 – Thanh toán của khách: /payments/:orderId/checkout, /payments/:orderId/retry. Bảng: payments
import { Body, Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':orderId/checkout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bắt đầu thanh toán: trả redirectUrl (trang kết quả hoặc URL cổng thanh toán)' })
  checkout(@CurrentUser('id') uid: number, @Param('orderId', ParseIntPipe) orderId: number) {
    return this.payments.checkout(uid, orderId);
  }

  @Post(':orderId/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thanh toán lại (có thể đổi phương thức)' })
  retry(
    @CurrentUser('id') uid: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: unknown,
  ) {
    return this.payments.retry(uid, orderId, body);
  }
}
