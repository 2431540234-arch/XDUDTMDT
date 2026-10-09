// Khung việc nền chậm đi kèm thông báo (ví dụ email thông báo). Hiện chỉ ghi log.
// Bản ghi `notifications` KHÔNG tạo ở đây: Service tạo trực tiếp trong cùng transaction nghiệp vụ (D-N19, D-T47).
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
