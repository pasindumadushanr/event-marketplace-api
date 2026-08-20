import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  subscribe(@Request() req, @Body('planId') planId: string) {
    return this.subscriptionsService.subscribe(req.user.id, planId);
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard) // Add RolesGuard in real app
  @Post('plans')
  createPlan(@Body() body: any) {
    return this.subscriptionsService.createPlan(body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.subscriptionsService.updatePlan(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('vendors')
  getAllVendorSubscriptions() {
    return this.subscriptionsService.getAllVendorSubscriptions();
  }
}
