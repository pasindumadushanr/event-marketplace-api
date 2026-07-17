import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { MockEmailProvider } from './providers/mock-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'EMAIL_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('SMTP_PROVIDER', 'mock');
        return provider === 'smtp' ? new SmtpEmailProvider() : new MockEmailProvider();
      },
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
