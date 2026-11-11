// UC-ADM-27 – Xem nhật ký hoạt động (chỉ đọc). Bảng: activity_logs
import { Module } from '@nestjs/common';
import { AdminActivityLogsController } from './admin-activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';

@Module({
  controllers: [AdminActivityLogsController],
  providers: [ActivityLogsService],
})
export class ActivityLogsModule {}
