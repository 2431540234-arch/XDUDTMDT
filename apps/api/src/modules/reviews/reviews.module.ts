// M11 – Đánh giá sản phẩm. Đánh giá sản phẩm
// Module – UC-REV-01, 02, 03; UC-ADM-18
// Bảng: reviews
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { ProductsModule } from '../products/products.module';
import { AdminReviewsService } from './admin-reviews.service';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [ProductsModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, AdminReviewsService],
  exports: [ReviewsService, AdminReviewsService],
})
export class ReviewsModule {}
