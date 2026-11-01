import { Module } from '@nestjs/common';
import { VendorGalleryService } from './vendor-gallery.service';
import { VendorGalleryController } from './vendor-gallery.controller';
import { MediaStorageModule } from '../common/providers/media-storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [MediaStorageModule, PrismaModule],
  providers: [VendorGalleryService],
  controllers: [VendorGalleryController],
})
export class VendorGalleryModule {}
