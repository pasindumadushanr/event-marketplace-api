import { Module } from '@nestjs/common';
import { AdminCmsService } from './admin-cms.service';
import { AdminCmsController } from './admin-cms.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaStorageModule } from '../common/providers/media-storage.module';

@Module({
  imports: [MediaStorageModule, PrismaModule],
  controllers: [AdminCmsController],
  providers: [AdminCmsService],
})
export class AdminCmsModule {}
