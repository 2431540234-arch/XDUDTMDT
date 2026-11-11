// M06 – Thương hiệu (công khai): GET /brands. Quản trị thương hiệu ở admin-brands. Bảng: brands
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Danh sách thương hiệu đang hoạt động' })
  async list() {
    const rows = await this.prisma.brand.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
    return rows.map((b) => ({ id: b.id, name: b.name, slug: b.slug }));
  }
}
