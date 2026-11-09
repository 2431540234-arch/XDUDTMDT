// M03 – Tài khoản cá nhân. Danh sách yêu thích
// Module – UC-ACC-06
// Bảng: wishlists
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
