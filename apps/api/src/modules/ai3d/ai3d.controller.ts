import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Ai3dService } from './ai3d.service';

@ApiTags('Admin – models')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/models')
export class Ai3dController {
  constructor(private readonly ai3d: Ai3dService) {}

  @Get('ai/status')
  @ApiOperation({ summary: 'Trạng thái tạo mô hình bằng AI: bật/tắt, space, hạn mức đã dùng, lỗi gần nhất' })
  status() {
    return this.ai3d.status();
  }

  @Post('ai')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Tạo mô hình bằng AI { productId, imageId, space?, removeFloor?, consent: true } ⇒ 202. Ảnh được gửi tới Hugging Face.',
  })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.ai3d.request(adminId, body);
  }

  @Post(':id/regenerate')
  @HttpCode(202)
  @ApiOperation({ summary: 'Tạo lại mô hình AI đang chờ duyệt hoặc lỗi { consent: true, space?, imageId? }' })
  regenerate(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.ai3d.regenerate(adminId, id, body);
  }
}
