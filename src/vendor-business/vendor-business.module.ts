import { Module } from '@nestjs/common';
import { VendorBusinessService } from './vendor-business.service';
import { VendorBusinessController } from './vendor-business.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [VendorBusinessController],
  providers: [
    VendorBusinessService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    }
  ],
})
export class VendorBusinessModule {}
