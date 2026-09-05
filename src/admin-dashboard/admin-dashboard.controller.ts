import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('stats')
  getStats(@Req() req: any) {
    return this.adminDashboardService.getStats(req.user.roleName);
  }
}
