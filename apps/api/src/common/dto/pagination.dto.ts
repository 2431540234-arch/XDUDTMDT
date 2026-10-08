import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** Query phân trang/sắp xếp dùng chung. Kế thừa để thêm bộ lọc riêng của từng module. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ example: 'createdAt:desc', description: 'truong:asc hoặc truong:desc' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z]+:(asc|desc)$/, { message: 'sort phải có dạng "truong:asc" hoặc "truong:desc"' })
  sort?: string;

  get skip() {
    return (this.page - 1) * this.pageSize;
  }

  get take() {
    return this.pageSize;
  }
}
