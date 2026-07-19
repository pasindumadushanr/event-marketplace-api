import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IEmailProvider } from './email.interface';
import { EmailTemplates } from './email.templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@Inject('EMAIL_PROVIDER') private readonly emailProvider: IEmailProvider) {}

  /**
   * Core sendMail function wrapping the Provider logic.
   * Other methods should always use this.
   */
  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      return await this.emailProvider.sendMail({ to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      // We return false rather than throwing so business logic is never blocked by email failures.
      return false;
    }
  }

  async sendContactConfirmation(email: string, name: string) {
    const html = EmailTemplates.getContactConfirmationTemplate(name);
    return this.sendMail(email, 'We received your inquiry - LuxeEvents', html);
  }

  async sendAdminContactNotification(adminEmail: string, name: string, email: string, message: string) {
    const html = EmailTemplates.getAdminContactNotificationTemplate(name, email, message);
    return this.sendMail(adminEmail, `New Contact Inquiry from ${name}`, html);
  }
}
