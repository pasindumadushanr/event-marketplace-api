import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RecaptchaModule } from '../recaptcha/recaptcha.module';

@Module({
  imports: [PrismaModule, RecaptchaModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
