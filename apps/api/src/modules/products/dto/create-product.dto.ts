// DTO validate dữ liệu đầu vào khi tạo sản phẩm mới
import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  // Không truyền thì tự sinh từ name, đảm bảo unique trước khi insert
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @MinLength(1)
  sku: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsNumber()
  @Min(0)
  widthCm: number;

  @IsNumber()
  @Min(0)
  heightCm: number;

  @IsNumber()
  @Min(0)
  depthCm: number;

  @IsString()
  @MinLength(1)
  categoryId: string;

  // Ảnh chính (tuỳ chọn) - nếu có sẽ tạo kèm 1 ProductImage isPrimary=true
  @IsOptional()
  @IsString()
  image?: string;
}
