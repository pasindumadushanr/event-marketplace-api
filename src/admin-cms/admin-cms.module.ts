import { Module } from '@nestjs/common';
import { AdminCmsService } from './admin-cms.service';
import { AdminCmsController } from './admin-cms.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCmsController],
  providers: [
    AdminCmsService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    }
  ],
})
export class AdminCmsModule {}
