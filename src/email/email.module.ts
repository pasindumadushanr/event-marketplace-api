import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { MockEmailProvider } from './providers/mock-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'EMAIL_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('SMTP_PROVIDER', 'mock');
        if (provider === 'smtp') return new SmtpEmailProvider(configService);
        if (provider === 'resend') return new ResendEmailProvider(configService);
        return new MockEmailProvider();
      },
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
