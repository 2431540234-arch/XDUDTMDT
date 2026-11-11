// UC-ADM-19 – Quản trị khuyến mãi: /admin/coupons (chỉ role admin). Bảng: coupons, coupon_scopes, coupon_usages
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminCouponsService } from './admin-coupons.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – coupons')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly coupons: AdminCouponsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách (tab=all|active|upcoming|ended, kind, q, sort); meta kèm số lượng từng tab',
  })
  async list(@Query() q: RawQuery) {
    const r = await this.coupons.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total, r.counts);
  }

  @Post()
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.coupons.create(adminId, body);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.coupons.get(id);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.coupons.update(adminId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.coupons.remove(adminId, id);
  }
}
