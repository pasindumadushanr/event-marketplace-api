import { Module } from '@nestjs/common';
import { VendorDocumentsService } from './vendor-documents.service';
import { VendorDocumentsController } from './vendor-documents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [VendorDocumentsController],
  providers: [
    VendorDocumentsService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    }
  ],
})
export class VendorDocumentsModule {}
