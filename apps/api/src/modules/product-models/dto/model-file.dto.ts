import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignModelFileDto {
  @ApiProperty({ enum: ['glb', 'usdz'] })
  @IsIn(['glb', 'usdz'])
  format!: 'glb' | 'usdz';

  @ApiPropertyOptional({
    enum: ['high', 'medium', 'low'],
    description: 'Chỉ dùng cho USDZ; GLB tự sinh đủ 3 LOD',
  })
  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  lod?: 'high' | 'medium' | 'low';

  @ApiProperty({ example: 'sofa-oslo.glb' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ description: 'Dung lượng byte, phải bằng dung lượng thật khi PUT' })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  size!: number;
}

export class ConfirmModelFileDto {
  @ApiProperty({ description: 'Object key nhận được ở bước presign' })
  @IsString()
  @MaxLength(500)
  key!: string;

  @ApiProperty({ enum: ['glb', 'usdz'] })
  @IsIn(['glb', 'usdz'])
  format!: 'glb' | 'usdz';

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'] })
  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  lod?: 'high' | 'medium' | 'low';

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;
}
