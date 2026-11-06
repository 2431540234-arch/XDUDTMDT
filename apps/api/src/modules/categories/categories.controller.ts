// M06 – Danh mục sản phẩm (công khai). Controller – UC-CAT-02 (cây danh mục). Bảng: categories
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Cây danh mục 2 cấp (kèm số sản phẩm)' })
  tree() {
    return this.categories.tree();
  }
}
