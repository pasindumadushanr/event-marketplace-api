import { Module } from '@nestjs/common';
import { StudioAccessGuard } from './studio-access.guard';
import { InvitationsService } from './invitations.service';
import {
  InvitationStudioController,
  PublicInvitationsController,
} from './invitations.controller';
import { MediaStorageModule } from '../common/providers/media-storage.module';
@Module({
  imports: [MediaStorageModule],
  controllers: [InvitationStudioController, PublicInvitationsController],
  providers: [StudioAccessGuard, InvitationsService],
})
export class InvitationsModule {}
