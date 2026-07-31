import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);

  console.log('Sending test email...');
  const success = await emailService.sendMail(
    'pasindumadushanr01@gmail.com',
    'Test from Event Marketplace 🚀',
    '<h1>It worked!</h1><p>Your Gmail SMTP integration is perfectly configured.</p>'
  );

  if (success) {
    console.log('Successfully sent test email!');
  } else {
    console.log('Failed to send test email.');
  }

  await app.close();
}

bootstrap();
