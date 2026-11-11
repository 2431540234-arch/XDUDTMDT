// Nội dung công khai: /banners, /posts, /faq, /contact, /settings/public
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('banners')
  @ApiOperation({ summary: 'Banner đang hiển thị' })
  banners() {
    return this.content.banners();
  }

  @Public()
  @Get('posts')
  posts() {
    return this.content.posts();
  }

  @Public()
  @Get('posts/:slug')
  post(@Param('slug') slug: string) {
    return this.content.postBySlug(slug);
  }

  @Public()
  @Get('faq')
  faq() {
    return this.content.faq();
  }

  // chống spam: tối đa 5 tin nhắn / phút / IP
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(200)
  @Post('contact')
  @ApiOperation({ summary: 'Gửi liên hệ: { fullName, phone, email, subject, content }' })
  contact(@Body() body: unknown) {
    return this.content.contact(body);
  }

  @Public()
  @Get('settings/public')
  @ApiOperation({ summary: 'Thông tin cửa hàng, phương thức thanh toán, vùng giao hàng' })
  settings() {
    return this.content.publicSettings();
  }
}
