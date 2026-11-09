// M03 – Tài khoản cá nhân. Sổ địa chỉ giao hàng
// Module – UC-ACC-04
// Bảng: addresses
// TRẠNG THÁI: đã cài đặt (module khai báo các controller/service thật bên dưới).
import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
