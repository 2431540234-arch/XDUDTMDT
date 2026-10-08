// Giao diện gửi email. Module nghiệp vụ chỉ phụ thuộc vào MAIL_SERVICE.
export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailService {
  send(message: MailMessage): Promise<void>;
}
