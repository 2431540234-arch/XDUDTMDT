// UC-ADM-18 – Quản trị đánh giá: /admin/reviews (chỉ role admin). Bảng: reviews
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminReviewsService } from './admin-reviews.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – reviews')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách (status=pending|approved|rejected, productId, q, sort=createdAt|rating)',
  })
  async list(@Query() q: RawQuery) {
    const r = await this.reviews.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Duyệt / Ẩn (rejected) / Hiện lại (approved): { status }' })
  status(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.reviews.setStatus(adminId, id, body);
  }
}
