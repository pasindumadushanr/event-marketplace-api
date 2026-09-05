import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';

import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    }
  ],
  exports: [UsersService],
})
export class UsersModule {}
