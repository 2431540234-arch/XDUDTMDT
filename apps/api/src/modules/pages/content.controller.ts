// Nội dung công khai: /faq, /settings/public
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('faq')
  faq() {
    return this.content.faq();
  }

  @Public()
  @Get('settings/public')
  @ApiOperation({ summary: 'Thông tin cửa hàng, phương thức thanh toán, vùng giao hàng' })
  settings() {
    return this.content.publicSettings();
  }
}
