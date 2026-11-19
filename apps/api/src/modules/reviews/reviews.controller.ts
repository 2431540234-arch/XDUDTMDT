// M13 – Đánh giá: /products/:slug/reviews (công khai + tạo) và /reviews/me, /reviews/:id (của chính khách). Bảng: reviews
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:slug/reviews')
  @ApiOperation({ summary: 'Đánh giá đang hiển thị của sản phẩm (lọc rating, phân trang 5/trang)' })
  async list(@Param('slug') slug: string, @Query() q: RawQuery) {
    const r = await this.reviews.listForProduct(slug, q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @ApiBearerAuth()
  @Post('products/:slug/reviews')
  @ApiOperation({ summary: 'Viết đánh giá (chỉ sản phẩm thuộc đơn đã giao của bạn)' })
  create(@CurrentUser('id') uid: number, @Param('slug') slug: string, @Body() body: unknown) {
    return this.reviews.create(uid, slug, body);
  }

  @ApiBearerAuth()
  @Get('reviews/me')
  mine(@CurrentUser('id') uid: number) {
    return this.reviews.mine(uid);
  }

  @ApiBearerAuth()
  @Patch('reviews/:id')
  update(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.reviews.update(uid, id, body);
  }

  @ApiBearerAuth()
  @Delete('reviews/:id')
  remove(@CurrentUser('id') uid: number, @Param('id', ParseIntPipe) id: number) {
    return this.reviews.remove(uid, id);
  }
}
