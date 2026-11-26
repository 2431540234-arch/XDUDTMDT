// M12 – Thanh toán: /payments/:orderId/checkout, /payments/:orderId/retry (khách), /payments/vnpay/ipn (cổng gọi) và
// /payments/vnpay/return-status (trang Return URL). Hai route vnpay công khai nhưng bắt buộc đúng chữ ký HMAC. Bảng: payments, orders
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
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
  @Get('vnpay/return-status')
  @ApiOperation({
    summary:
      'Trang Return URL: kiểm chữ ký, trả { valid, orderCode, responseCode, paymentStatus }; còn pending thì hỏi cổng (querydr)',
  })
  returnStatus(@Query() query: Record<string, unknown>) {
    return this.payments.returnStatus(query);
  }

  // IPN gọi từ máy chủ cổng: không áp rate limit chung (chữ ký là lớp bảo vệ)
  @Public()
  @SkipThrottle({ default: true })
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
