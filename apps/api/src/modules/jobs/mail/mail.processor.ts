// Gửi email thật qua SMTP (Mailpit khi dev). Lỗi SMTP làm job thất bại -> BullMQ thử lại 3 lần, backoff mũ.
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SmtpMailService } from '../../../mail/smtp-mail.service';
import { MAIL_QUEUE, type MailJobData } from '../jobs.constants';

@Processor(MAIL_QUEUE, { concurrency: 5 })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly smtp: SmtpMailService) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    await this.smtp.send(job.data); // luôn gửi trực tiếp: tránh vòng lặp queue -> queue
    this.logger.log(`Đã gửi email "${job.data.subject}" tới ${job.data.to} (job ${job.id})`);
  }
}
