import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../common/exceptions/app.exception';
import { AppConfig } from '../config/app-config.service';
import type { MailMessage, MailService } from './mail.service';

/** Gửi qua SMTP. Dev trỏ tới Mailpit (localhost:1025, xem thư tại http://localhost:8025). */
@Injectable()
export class SmtpMailService implements MailService {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: AppConfig) {
    this.from = config.get('MAIL_FROM');
    this.transporter = createTransport({
      host: config.get('MAIL_HOST'),
      port: config.get('MAIL_PORT'),
      secure: false,
    });
  }

  /** Kiểm tra kết nối SMTP (dùng cho /health). Ném lỗi nếu không kết nối được. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
    } catch (e) {
      this.logger.error(`Gửi email tới ${message.to} thất bại: ${(e as Error).message}`);
      throw new AppException(ErrorCode.BAD_GATEWAY, 'Không gửi được email, vui lòng thử lại sau.');
    }
  }
}
