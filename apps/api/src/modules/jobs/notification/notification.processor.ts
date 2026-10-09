// Khung xử lý thông báo trong ứng dụng. Hiện chỉ ghi log; M09 (đợt đơn hàng) sẽ tạo bản ghi `notifications`
// và có thể đẩy email qua queue `mail`.
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE, type NotificationJobData } from '../jobs.constants';

@Processor(NOTIFICATION_QUEUE, { concurrency: 5 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  process(job: Job<NotificationJobData>): Promise<void> {
    const { userId, type, title } = job.data;
    this.logger.log(`Thông báo [${type}] cho user ${userId}: ${title} (job ${job.id})`);
    return Promise.resolve();
  }
}
