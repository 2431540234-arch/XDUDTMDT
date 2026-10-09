import { Injectable } from '@nestjs/common';
import { JobsService } from '../modules/jobs/jobs.service';
import type { MailMessage, MailService } from './mail.service';

/**
 * MailService đẩy job vào hàng đợi `mail` thay vì gửi trực tiếp (MAIL_TRANSPORT=queue, mặc định).
 * Request không phải chờ SMTP; lỗi SMTP được retry 3 lần với backoff mũ trong MailProcessor.
 */
@Injectable()
export class MailQueueService implements MailService {
  constructor(private readonly jobs: JobsService) {}

  async send(message: MailMessage): Promise<void> {
    await this.jobs.enqueueMail(message);
  }
}
