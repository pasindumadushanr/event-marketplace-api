import { Module } from '@nestjs/common';
import { AdminApprovalsService } from './admin-approvals.service';
import { AdminApprovalsController } from './admin-approvals.controller';

@Module({
  providers: [AdminApprovalsService],
  controllers: [AdminApprovalsController]
})
export class AdminApprovalsModule {}
