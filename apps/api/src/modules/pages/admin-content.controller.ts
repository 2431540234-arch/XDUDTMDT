// UC-ADM – Quản trị nội dung: /admin/banners, /admin/posts, /admin/faq, /admin/contact-messages (chỉ role admin)
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { paginated } from '../../common/interceptors/transform-response.interceptor';
import type { RawQuery } from '../../common/utils/list-query';
import { AdminContentService } from './admin-content.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – content')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin')
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  // ---- banner
  @Get('banners')
  banners() {
    return this.content.banners();
  }

  @Post('banners')
  createBanner(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.content.saveBanner(adminId, null, body);
  }

  // reorder phải khai báo trước :id
  @Patch('banners/reorder')
  @ApiOperation({ summary: 'Lưu thứ tự kéo thả: { ids: [id theo thứ tự mới] }' })
  reorder(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.content.reorderBanners(adminId, body);
  }

  @Patch('banners/:id')
  updateBanner(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.content.saveBanner(adminId, id, body);
  }

  @Delete('banners/:id')
  deleteBanner(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.content.deleteBanner(adminId, id);
  }

  // ---- bài viết
  @Get('posts')
  posts() {
    return this.content.posts();
  }

  @Post('posts')
  createPost(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.content.savePost(adminId, null, body);
  }

  @Patch('posts/:id')
  updatePost(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.content.savePost(adminId, id, body);
  }

  @Delete('posts/:id')
  deletePost(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.content.deletePost(adminId, id);
  }

  // ---- FAQ (lưu trong settings)
  @Get('faq')
  faq() {
    return this.content.faq();
  }

  @Put('faq')
  @ApiOperation({ summary: 'Thay toàn bộ FAQ: { topics: [{ key?, label, items: [{ question, answer }] }] }' })
  saveFaq(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.content.saveFaq(adminId, body);
  }

  // ---- liên hệ
  @Get('contact-messages')
  @ApiOperation({ summary: 'Tin nhắn liên hệ (handled=true|false, phân trang)' })
  async contacts(@Query() q: RawQuery) {
    const r = await this.content.contactMessages(q);
    return paginated(r.items, r.page, r.pageSize, r.total);
  }

  @Patch('contact-messages/:id/handled')
  @HttpCode(200)
  handled(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.content.markHandled(adminId, id, body);
  }
}
