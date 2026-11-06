// UC-ADM – Quản trị không gian mẫu: /admin/spaces (chỉ role admin). Bảng: spaces, space_panoramas, space_hotspots
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminSpacesService } from './admin-spaces.service';

@ApiTags('Admin – spaces')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/spaces')
export class AdminSpacesController {
  constructor(private readonly spaces: AdminSpacesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách (q, roomType, status, sort, phân trang)' })
  async list(@Query() q: RawQuery) {
    const r = await this.spaces.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  @ApiOperation({
    summary:
      'Thêm không gian: thông tin, coverUrl, panoramas[{url,title,hotspots[]}], productIds, status, comboDiscountPercent',
  })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.spaces.create(adminId, body);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.spaces.get(id);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.spaces.update(adminId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.spaces.remove(adminId, id);
  }
}
