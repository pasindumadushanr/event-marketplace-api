import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  Request,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
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
  async getApplications(@Query() query: any) {
    const result = await this.service.getApplications(query);
    // Keep the old array response during the independent Render/Vercel rollout.
    return query.workspace === '1' ? result : result.items;
  }

  @Get('launch-overview')
  getLaunchOverview(
    @Query('district') district?: string,
    @Query('page') page?: string,
  ) {
    return this.service.getLaunchOverview(district, page);
  }

  @Patch(':id/approve')
  approveApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.service.approveApplication(id, req.user);
  }

  @Patch(':id/reject')
  rejectApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.service.rejectApplication(id, reason, req.user);
  }

  @Get(':id')
  getApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('historyPage') page?: string,
  ) {
    return this.service.getApplication(id, page);
  }

  @Patch(':id/request-information')
  requestInformation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('message') message: string,
    @Request() req: any,
  ) {
    return this.service.requestInformation(id, message, req.user);
  }

  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note: string,
    @Request() req: any,
  ) {
    return this.service.addNote(id, note, req.user);
  }

  @Post(':id/notifications/:eventId/retry')
  retryNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Request() req: any,
  ) {
    return this.service.retryNotification(id, eventId, req.user);
  }
}
