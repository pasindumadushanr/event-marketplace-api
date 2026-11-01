import { Module } from '@nestjs/common';
import { VendorBusinessService } from './vendor-business.service';
import { VendorBusinessController } from './vendor-business.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { MediaStorageModule } from '../common/providers/media-storage.module';

@Module({
  imports: [MediaStorageModule, PrismaModule, EmailModule],
  controllers: [VendorBusinessController],
  providers: [VendorBusinessService],
})
export class VendorBusinessModule {}
