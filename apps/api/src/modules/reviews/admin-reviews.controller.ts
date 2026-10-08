// M11 – Đánh giá sản phẩm. Đánh giá sản phẩm
// Controller – UC-ADM-18
// Bảng: reviews
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';

@ApiTags('Admin – reviews')
@Roles('admin')
@Controller('admin/reviews')
export class AdminReviewsController {}
