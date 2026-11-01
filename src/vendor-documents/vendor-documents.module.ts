import { Module } from '@nestjs/common';
import { VendorDocumentsService } from './vendor-documents.service';
import { VendorDocumentsController } from './vendor-documents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaStorageModule } from '../common/providers/media-storage.module';

@Module({
  imports: [MediaStorageModule, PrismaModule],
  controllers: [VendorDocumentsController],
  providers: [VendorDocumentsService],
})
export class VendorDocumentsModule {}
