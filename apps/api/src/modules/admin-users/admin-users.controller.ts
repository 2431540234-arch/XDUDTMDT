// UC-ADM-01 – Quản trị khách hàng: /admin/users (chỉ role admin). Bảng: users, user_roles
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminUsersService } from './admin-users.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – users')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khách hàng (group=new|loyal, status=active|locked, q, sort)' })
  async list(@Query() q: RawQuery) {
    const r = await this.users.list(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Post()
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.users.create(adminId, body);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.users.detail(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Khóa/mở khóa: { status: "active" | "suspended" }; khóa ⇒ thu hồi phiên, chặn đăng nhập',
  })
  status(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.users.setStatus(adminId, id, body);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.users.update(adminId, id, body);
  }

  @Get(':id/orders')
  async orders(@Param('id', ParseIntPipe) id: number, @Query() q: RawQuery) {
    const r = await this.users.orders(id, q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Get(':id/reviews')
  reviews(@Param('id', ParseIntPipe) id: number) {
    return this.users.customerReviews(id);
  }

  @Get(':id/wishlist')
  wishlist(@Param('id', ParseIntPipe) id: number) {
    return this.users.customerWishlist(id);
  }
}
