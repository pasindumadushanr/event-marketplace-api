import { Module } from '@nestjs/common';
import { VendorGalleryService } from './vendor-gallery.service';
import { VendorGalleryController } from './vendor-gallery.controller';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    VendorGalleryService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    }
  ],
  controllers: [VendorGalleryController]
})
export class VendorGalleryModule {}
