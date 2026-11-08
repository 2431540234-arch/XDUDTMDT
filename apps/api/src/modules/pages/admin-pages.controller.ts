// UC-ADM – Trang tĩnh & chính sách: /admin/pages (chỉ role admin). Bảng: pages
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AdminContentService } from './admin-content.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – pages')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly content: AdminContentService) {}

  @Get()
  list() {
    return this.content.pages();
  }

  @Post()
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.content.savePage(adminId, null, body);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.content.savePage(adminId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.content.deletePage(adminId, id);
  }
}
