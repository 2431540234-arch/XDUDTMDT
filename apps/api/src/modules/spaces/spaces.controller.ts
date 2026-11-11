// M15 – Không gian mẫu (công khai + lưu yêu thích): /spaces. Quản trị ở admin-spaces.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
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
    summary:
      'Danh sách không gian mẫu (lọc roomType, style, q, bookmarked, product = slug sản phẩm có trong không gian; sắp xếp newest|popular|title)',
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

  @Public()
  @Get(':slug/placements/:placementId/alternatives')
  @ApiOperation({
    summary:
      'Đổi món (UC-SPACE-05): sản phẩm cùng danh mục có mô hình ready để thay thử tại vị trí này. Không lưu vào DB',
  })
  alternatives(@Param('slug') slug: string, @Param('placementId', ParseIntPipe) placementId: number) {
    return this.spaces.alternatives(slug, placementId);
  }

  @Public()
  @Post(':slug/views')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Ghi MỘT lượt xem khi rời trang (sendBeacon): { visitorId, sourceProductId? (id hoặc slug), hotspotClickCount?, addedToCart?, accessToken? } ⇒ 204',
  })
  view(@Param('slug') slug: string, @Body() body: unknown, @CurrentUser('id') userId?: number) {
    return this.spaces.recordView(slug, userId ?? null, body);
  }

  @ApiBearerAuth()
  @Post(':slug/add-to-cart')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Thêm bộ sản phẩm vào giỏ (một transaction, tất cả hoặc không món nào). Body tùy chọn { productIds }. Có món không thêm được ⇒ 409 kèm details.unavailable',
  })
  addToCart(@CurrentUser('id') uid: number, @Param('slug') slug: string, @Body() body: unknown) {
    return this.spaces.addAllToCart(uid, slug, body);
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
