// UC-ADM-08 – Quản lý thuộc tính và giá trị: /admin/attributes (chỉ role admin). Bảng: attributes, attribute_values
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AttributesService } from './attributes.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Admin – attributes')
@ApiBearerAuth()
@Roles('admin')
@RequirePermission('manage_products')
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thuộc tính kèm giá trị và số biến thể đang dùng' })
  list() {
    return this.attributes.list();
  }

  @Post()
  @ApiOperation({ summary: 'Thêm thuộc tính { code (chữ thường ≤ 50), name (≤ 100) } – trùng ⇒ 409' })
  create(@CurrentUser('id') adminId: number, @Body() body: unknown) {
    return this.attributes.create(adminId, body);
  }

  @Patch(':id')
  update(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.attributes.update(adminId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa thuộc tính (không xóa thuộc tính hệ thống hoặc có giá trị đang dùng ⇒ 409)' })
  remove(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.attributes.remove(adminId, id);
  }

  @Post(':id/values')
  @ApiOperation({ summary: 'Thêm giá trị { value (≤ 150), colorHex? (#RRGGBB, chỉ màu sắc) } – trùng ⇒ 409' })
  addValue(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.attributes.addValue(adminId, id, body);
  }

  @Patch(':id/values/:valueId')
  updateValue(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() body: unknown,
  ) {
    return this.attributes.updateValue(adminId, id, valueId, body);
  }

  @Delete(':id/values/:valueId')
  @ApiOperation({ summary: 'Xóa giá trị; đang được biến thể dùng ⇒ 409' })
  removeValue(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('valueId', ParseIntPipe) valueId: number,
  ) {
    return this.attributes.removeValue(adminId, id, valueId);
  }
}
