import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignUploadDto {
  @ApiProperty({
    enum: ['panorama'],
    description: 'Chỉ panorama dùng presigned PUT; ảnh thường tải qua POST /admin/media (multipart)',
  })
  @IsIn(['panorama'])
  kind!: 'panorama';

  @ApiProperty({ example: 'sofa-oslo.jpg' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'Dung lượng byte, phải bằng dung lượng thật khi PUT' })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  size!: number;
}

export class ConfirmUploadDto {
  @ApiProperty({ description: 'Object key nhận được ở bước presign' })
  @IsString()
  @MaxLength(500)
  key!: string;

  @ApiProperty({
    enum: ['panorama'],
    description: 'Chỉ panorama dùng presigned PUT; ảnh thường tải qua POST /admin/media (multipart)',
  })
  @IsIn(['panorama'])
  kind!: 'panorama';

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
