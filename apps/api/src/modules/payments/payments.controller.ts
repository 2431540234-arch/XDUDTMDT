// M12 – Thanh toán: /payments/:orderId/checkout, /payments/:orderId/retry (khách) và /payments/vnpay/return, /payments/vnpay/ipn
// (cổng gọi, công khai nhưng bắt buộc đúng chữ ký HMAC). Bảng: payments, orders
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // các route tĩnh (vnpay/…) khai báo trước route có tham số
  @Public()
  @Get('vnpay/return')
  @ApiOperation({
    summary: 'Return URL VNPAY: kiểm tra chữ ký, ghi nhận kết quả, chuyển tới /checkout/success|failed',
  })
  async vnpayReturn(@Query() query: Record<string, unknown>, @Res() res: Response) {
    // trả thẳng bằng @Res(): không đi qua lớp bọc { success, data }
    res.redirect(302, await this.payments.returnUrl(query));
  }

  @Public()
  @Get('vnpay/ipn')
  @ApiOperation({
    summary: 'IPN VNPAY (server-to-server), idempotent, trả { RspCode, Message } theo chuẩn VNPAY',
  })
  async vnpayIpn(@Query() query: Record<string, unknown>, @Res() res: Response) {
    // cổng VNPAY đọc JSON { RspCode, Message } nguyên văn, không có lớp bọc
    res.json(await this.payments.ipn(query));
  }

  @Post(':orderId/checkout')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Bắt đầu thanh toán: { redirectUrl, paymentUrl?, expiresAt? } – URL cổng VNPAY có chữ ký hoặc trang kết quả (giả lập)',
  })
  checkout(
    @CurrentUser('id') uid: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Req() req: Request,
  ) {
    return this.payments.checkout(uid, orderId, req.ip);
  }

  @Post(':orderId/retry')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Thanh toán lại (có thể đổi phương thức): giao dịch cũ ⇒ failed, tạo giao dịch mới',
  })
  retry(
    @CurrentUser('id') uid: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.payments.retry(uid, orderId, body, req.ip);
  }
}
