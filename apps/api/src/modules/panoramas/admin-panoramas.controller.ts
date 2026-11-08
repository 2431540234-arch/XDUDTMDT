// M13 – Không gian mẫu 360°. UC-ADM-17: đặt mô hình 3D của sản phẩm vào ảnh 360° (:id là id ẢNH 360°, space_panoramas.id)
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { PanoramasService } from './panoramas.service';

@ApiTags('Admin – panoramas')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_content')
@Controller('admin/panoramas')
export class AdminPanoramasController {
  constructor(private readonly panoramas: PanoramasService) {}

  @Get(':id/placements')
  @ApiOperation({ summary: 'Các mô hình 3D đã đặt trong ảnh 360° (kèm tệp GLB các LOD và vật liệu)' })
  list(@Param('id', ParseIntPipe) id: number) {
    return this.panoramas.list(id);
  }

  @Post(':id/placements')
  @ApiOperation({
    summary:
      'Đặt mô hình: { productId, variantId?, modelId? (mặc định mô hình chính), yaw, pitch, distance (>0), rotationX/Y/Z?, scale? (>0) } ⇒ 201',
  })
  create(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.panoramas.create(adminId, id, body);
  }

  @Patch(':id/placements/:placementId')
  @ApiOperation({ summary: 'Sửa vị trí/xoay/tỉ lệ/biến thể/mô hình (chỉ gửi trường cần đổi)' })
  update(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('placementId', ParseIntPipe) placementId: number,
    @Body() body: unknown,
  ) {
    return this.panoramas.update(adminId, id, placementId, body);
  }

  @Delete(':id/placements/:placementId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gỡ mô hình khỏi ảnh 360°' })
  remove(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('placementId', ParseIntPipe) placementId: number,
  ) {
    return this.panoramas.remove(adminId, id, placementId);
  }
}
