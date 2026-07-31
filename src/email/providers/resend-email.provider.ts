import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailProvider, SendMailOptions } from '../email.interface';

export class ResendEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not defined in environment variables');
    }
    this.resend = new Resend(apiKey);
    this.logger.log('Resend Email Provider initialized');
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    try {
      const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL', 'noreply@eventmarketplace.com');
      
      const { data, error } = await this.resend.emails.send({
        from: `Event Marketplace <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        this.logger.error(`Resend API Error sending to ${options.to}:`, error);
        return false;
      }

      this.logger.log(`Email sent successfully via Resend to ${options.to}. ID: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email via Resend to ${options.to}`, error);
      return false;
    }
  }
}
