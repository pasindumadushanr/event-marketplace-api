import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // USER ROUTES (Any authenticated user)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyNotifications(@Request() req: any) {
    return this.notificationsService.getUserNotifications(
      req.user.id,
      req.user.roleName,
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  // ADMIN ROUTES
  @Get('admin/broadcasts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  getBroadcasts() {
    return this.notificationsService.getAdminBroadcasts();
  }

  @Post('admin/broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  createBroadcast(
    @Body()
    data: {
      title: string;
      message: string;
      targetRole?: string;
      userId?: string;
    },
  ) {
    return this.notificationsService.createBroadcast(data);
  }
}
