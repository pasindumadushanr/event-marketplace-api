import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { GrantFreeDto } from './dto/grant-free.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Public/Vendor endpoints
  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-subscription')
  getCurrentSubscription(@Request() req) {
    return this.subscriptionsService.getCurrentSubscription(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@Request() req, @Body() body: GrantFreeDto) {
    return this.subscriptionsService.subscribe(req.user.id, body.planId);
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('plans')
  createPlan(@Body() body: any) {
    return this.subscriptionsService.createPlan(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.subscriptionsService.updatePlan(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('vendors')
  getAllVendorSubscriptions() {
    return this.subscriptionsService.getAllVendorSubscriptions();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('vendors/:vendorId/grant-free')
  grantFreeSubscription(
    @Param('vendorId') vendorId: string, 
    @Body() body: GrantFreeDto
  ) {
    return this.subscriptionsService.grantFreeSubscription(vendorId, body.planId);
  }
}
