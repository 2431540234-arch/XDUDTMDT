// DTO validate query string khi lấy danh sách sản phẩm (GET /products)
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryProductDto {
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // true = chỉ lấy sản phẩm đang giảm giá (có compareAtPrice > basePrice)
  @IsOptional()
  @IsIn(["true", "false"])
  promotion?: string;
}
