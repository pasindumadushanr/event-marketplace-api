import { Module } from '@nestjs/common';
import { StudioAccessGuard } from './studio-access.guard';
import { InvitationsService } from './invitations.service';
import {
  InvitationStudioController,
  PublicInvitationsController,
} from './invitations.controller';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import { CloudinaryStorageProvider } from '../common/providers/cloudinary-storage.provider';
@Module({
  controllers: [InvitationStudioController, PublicInvitationsController],
  providers: [
    StudioAccessGuard,
    InvitationsService,
    { provide: STORAGE_PROVIDER, useClass: CloudinaryStorageProvider },
  ],
})
export class InvitationsModule {}
