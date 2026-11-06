// M11 – Đánh giá sản phẩm. Đánh giá sản phẩm
// Module – UC-REV-01, 02, 03; UC-ADM-18
// Bảng: reviews
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { ProductsModule } from '../products/products.module';
import { AdminQuestionsController } from './admin-questions.controller';
import { AdminQuestionsService } from './admin-questions.service';
import { AdminReviewsService } from './admin-reviews.service';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [ProductsModule],
  controllers: [ReviewsController, AdminReviewsController, AdminQuestionsController],
  providers: [ReviewsService, QuestionsService, AdminReviewsService, AdminQuestionsService],
  exports: [ReviewsService, QuestionsService, AdminReviewsService, AdminQuestionsService],
})
export class ReviewsModule {}
