// M10 – Mã giảm giá của khách: /coupons/me, /coupons/suggested, /coupons/save. Áp mã vào giỏ: POST /cart/coupon.
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { RawQuery } from '../../common/utils/list-query';
import { CouponsService } from './coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get('me')
  mine(@CurrentUser('id') uid: number, @Query() q: RawQuery) {
    return this.coupons.mine(uid, q);
  }

  @Get('suggested')
  suggested(@CurrentUser('id') uid: number) {
    return this.coupons.suggested(uid);
  }

  @Post('save')
  @HttpCode(200)
  save(@CurrentUser('id') uid: number, @Body() body: unknown) {
    return this.coupons.save(uid, body);
  }
}
