// M04 – Người dùng và phân quyền (admin). Quản lý người dùng
// Module – UC-ADM-01
// Bảng: users, user_roles
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminRolesModule } from '../admin-roles/admin-roles.module';
import { UsersModule } from '../users/users.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AdminRolesModule, UsersModule, OrdersModule, ReviewsModule, WishlistModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
