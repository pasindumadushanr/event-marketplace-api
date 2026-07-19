import { Module } from '@nestjs/common';
import { VendorBusinessService } from './vendor-business.service';
import { VendorBusinessController } from './vendor-business.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LocalStorageProvider } from '../common/providers/local-storage.provider';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [VendorBusinessController],
  providers: [
    VendorBusinessService,
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    }
  ],
})
export class VendorBusinessModule {}
