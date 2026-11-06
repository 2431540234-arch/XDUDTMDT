// M16 – Đổi trả của khách: /returns. Bảng: return_requests
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { ReturnsService } from './returns.service';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: 'Yêu cầu đổi trả của tôi (lọc status, phân trang 5/trang)' })
  async list(@CurrentUser('id') uid: number, @Query() q: RawQuery) {
    const r = await this.returns.list(uid, q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  @ApiOperation({ summary: 'Gửi yêu cầu đổi trả (trong 7 ngày kể từ khi giao)' })
  @ApiBody({
    schema: {
      example: {
        orderId: 1,
        items: [{ orderItemId: 1, quantity: 1 }],
        type: 'refund',
        reason: 'defect',
        description: 'Sản phẩm bị trầy xước khi nhận hàng',
        images: ['data:image/png;base64,...'],
      },
    },
  })
  create(@CurrentUser('id') uid: number, @Body() body: unknown) {
    return this.returns.create(uid, body);
  }
}
