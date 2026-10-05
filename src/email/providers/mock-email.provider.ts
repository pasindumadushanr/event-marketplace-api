import { Logger } from '@nestjs/common';
import { IEmailProvider, SendMailOptions } from '../email.interface';

export class MockEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async sendMail(options: SendMailOptions): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('EMAIL_NOT_CONFIGURED: Email was not sent. Configure a real email provider.');
      return false;
    }
    this.logger.log('================= MOCK EMAIL SENT =================');
    this.logger.log(
      `To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
    );
    this.logger.log(`Subject: ${options.subject}`);
    this.logger.log(`Body Snippet: ${options.html.substring(0, 100)}...`);
    this.logger.log('===================================================');
    return true;
  }
}
