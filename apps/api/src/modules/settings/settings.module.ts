// M01 – Hệ thống và cấu hình. Cài đặt hệ thống (whitelist key công khai)
// Module – UC-ADM-03 (đọc công khai); UC-ADM-03
// Bảng: settings
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
