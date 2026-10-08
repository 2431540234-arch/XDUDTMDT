// M12 – Mô hình 3D và AR. Ảnh AR của người dùng và ảnh công khai
// Module – UC-3D-04, 05, 06; UC-ADM-30
// Bảng: ar_snapshots
// TRẠNG THÁI: khung rỗng, chưa cài đặt logic.
import { Module } from '@nestjs/common';
import { ArSnapshotsController } from './ar-snapshots.controller';
import { AdminArSnapshotsController } from './admin-ar-snapshots.controller';
import { ArSnapshotsService } from './ar-snapshots.service';

@Module({
  controllers: [ArSnapshotsController, AdminArSnapshotsController],
  providers: [ArSnapshotsService],
  exports: [ArSnapshotsService],
})
export class ArSnapshotsModule {}
