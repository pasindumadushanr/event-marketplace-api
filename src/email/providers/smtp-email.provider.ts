import { Logger } from '@nestjs/common';
import { IEmailProvider, SendMailOptions } from '../email.interface';

export class SmtpEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  // In the future, constructor will take SMTP config and initialize nodemailer/brevo etc.

  async sendMail(options: SendMailOptions): Promise<boolean> {
    this.logger.warn('Real SMTP provider is not yet fully implemented. Email not sent.');
    // TODO: Implement actual SMTP sending logic here (e.g. nodemailer.sendMail)
    return false;
  }
}
