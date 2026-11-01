import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MediaStorageModule } from '../common/providers/media-storage.module';

import { EmailModule } from '../email/email.module';

@Module({
  imports: [MediaStorageModule, EmailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
