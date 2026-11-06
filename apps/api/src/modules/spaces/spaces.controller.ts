// M15 – Không gian mẫu (công khai + lưu yêu thích): /spaces. Quản trị ở admin-spaces.
import { Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { SpacesService } from './spaces.service';

@ApiTags('spaces')
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách không gian mẫu (lọc roomType, style, q, bookmarked; sắp xếp newest|popular|title)',
  })
  async list(@Query() q: RawQuery, @CurrentUser('id') userId?: number) {
    const r = await this.spaces.list(q, userId ?? null);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Public()
  @Get('facets')
  facets() {
    return this.spaces.facets();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết: ảnh 360°, hotspot, sản phẩm trong không gian, giá combo' })
  detail(@Param('slug') slug: string, @CurrentUser('id') userId?: number) {
    return this.spaces.detail(slug, userId ?? null);
  }

  @ApiBearerAuth()
  @Post(':slug/add-to-cart')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thêm cả bộ vào giỏ: trả { added, unavailable (món hết hàng kèm lý do), cart }' })
  addToCart(@CurrentUser('id') uid: number, @Param('slug') slug: string) {
    return this.spaces.addAllToCart(uid, slug);
  }

  @ApiBearerAuth()
  @Put(':slug/bookmark')
  bookmark(@CurrentUser('id') uid: number, @Param('slug') slug: string) {
    return this.spaces.bookmark(uid, slug);
  }

  @ApiBearerAuth()
  @Delete(':slug/bookmark')
  unbookmark(@CurrentUser('id') uid: number, @Param('slug') slug: string) {
    return this.spaces.unbookmark(uid, slug);
  }
}
