import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { VendorRevenueService } from './vendor-revenue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('vendor/revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorRevenueController {
  constructor(private readonly vendorRevenueService: VendorRevenueService) {}

  @Get('stats')
  getRevenueStats(@Request() req: any) {
    return this.vendorRevenueService.getRevenueStats(req.user.id);
  }

  @Get('chart-data')
  getChartData(@Request() req: any) {
    return this.vendorRevenueService.getChartData(req.user.id);
  }
}
