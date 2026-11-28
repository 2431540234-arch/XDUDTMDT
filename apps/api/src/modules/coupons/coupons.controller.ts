// UC-CART-04 – Mã giảm giá cho khách: GET /coupons/available (cần đăng nhập, theo JwtAuthGuard toàn cục).
// Chỉ trả mã CÔNG KHAI còn dùng được, kèm tình trạng theo giỏ hiện tại. Áp/gỡ mã vẫn ở /cart/coupon.
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { CartService } from '../cart/cart.service';
import { CouponsService } from './coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly cart: CartService,
  ) {}

  @Get('available')
  @ApiOperation({
    summary:
      'Mã giảm giá công khai khách còn dùng được, kèm eligible/reason/estimatedDiscount/isApplied theo giỏ hiện tại',
  })
  async available(@CurrentUser('id') uid: number) {
    return this.coupons.listAvailable(uid, await this.cart.view(uid));
  }
}
