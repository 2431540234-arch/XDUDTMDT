// M06 – Trang tĩnh & chính sách (công khai): GET /pages?type=policy, GET /pages/:slug. Bảng: pages
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { ContentService } from './content.service';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get()
  list(@Query('type') type?: string) {
    // FE chỉ dùng type=policy để dựng menu chính sách
    void type;
    return this.content.policies();
  }

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.content.pageBySlug(slug);
  }
}
