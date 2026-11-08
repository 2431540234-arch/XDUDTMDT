// UC-ADM-05 – Quản trị danh mục: /admin/categories (chỉ role admin). Bảng: categories
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AdminCategoriesService } from './admin-categories.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – categories')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  tree() {
    return this.categories.tree();
  }

  @Post()
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.categories.create(adminId, body);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.categories.update(adminId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(adminId, id);
  }
}
