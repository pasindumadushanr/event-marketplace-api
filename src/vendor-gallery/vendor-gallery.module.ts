import { Module } from '@nestjs/common';
import { VendorGalleryService } from './vendor-gallery.service';
import { VendorGalleryController } from './vendor-gallery.controller';

@Module({
  providers: [VendorGalleryService],
  controllers: [VendorGalleryController]
})
export class VendorGalleryModule {}
