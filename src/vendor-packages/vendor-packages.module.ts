import { Module } from '@nestjs/common';
import { VendorPackagesController } from './vendor-packages.controller';
import { VendorPackagesService } from './vendor-packages.service';
import { MediaStorageModule } from '../common/providers/media-storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [MediaStorageModule, PrismaModule],
  controllers: [VendorPackagesController],
  providers: [VendorPackagesService],
})
export class VendorPackagesModule {}
