import { Module } from '@nestjs/common';
import { RecaptchaGuard } from './recaptcha.guard';

@Module({ providers: [RecaptchaGuard], exports: [RecaptchaGuard] })
export class RecaptchaModule {}
