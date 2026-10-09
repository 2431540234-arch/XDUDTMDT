import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { MailQueueService } from './mail-queue.service';
import { MAIL_SERVICE } from './mail.service';
import { SmtpMailService } from './smtp-mail.service';

@Global()
@Module({
  providers: [
    SmtpMailService,
    {
      provide: MAIL_SERVICE,
      inject: [AppConfig, SmtpMailService, JobsService],
      // MAIL_TRANSPORT=direct: gửi SMTP ngay; queue (mặc định): đẩy vào hàng đợi `mail`
      useFactory: (config: AppConfig, smtp: SmtpMailService, jobs: JobsService) =>
        config.get('MAIL_TRANSPORT') === 'direct' ? smtp : new MailQueueService(jobs),
    },
  ],
  exports: [MAIL_SERVICE, SmtpMailService],
})
export class MailModule {}
