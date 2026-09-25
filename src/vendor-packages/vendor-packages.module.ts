import { Module } from '@nestjs/common';
import { VendorPackagesController } from './vendor-packages.controller';
import { VendorPackagesService } from './vendor-packages.service';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorPackagesController],
  providers: [
    VendorPackagesService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    },
  ],
})
export class VendorPackagesModule {}
