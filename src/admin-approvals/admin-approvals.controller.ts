import { Controller, Get, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AdminApprovalsService } from './admin-approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('admin/vendors/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminApprovalsController {
  constructor(private readonly service: AdminApprovalsService) {}

  @Get()
  getApplications(@Query('status') status?: string) {
    return this.service.getApplications(status);
  }

  @Patch(':id/approve')
  approveApplication(@Param('id') id: string) {
    return this.service.approveApplication(id);
  }

  @Patch(':id/reject')
  rejectApplication(@Param('id') id: string, @Body('reason') reason: string) {
    return this.service.rejectApplication(id, reason);
  }
}
