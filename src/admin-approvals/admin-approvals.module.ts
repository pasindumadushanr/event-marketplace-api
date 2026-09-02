import { Module } from '@nestjs/common';
import { AdminApprovalsService } from './admin-approvals.service';
import { AdminApprovalsController } from './admin-approvals.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [AdminApprovalsService],
  controllers: [AdminApprovalsController]
})
export class AdminApprovalsModule {}
