import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { CustomerAccountService } from './customer-account.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customer/account')
@UseGuards(JwtAuthGuard)
export class CustomerAccountController {
  constructor(private readonly service: CustomerAccountService) {}

  @Get('bookings')
  getBookings(@Request() req: any) {
    return this.service.getBookings(req.user.userId);
  }

  @Get('favorites')
  getFavorites(@Request() req: any) {
    return this.service.getFavorites(req.user.userId);
  }

  @Post('favorites/:businessId')
  addFavorite(@Request() req: any, @Param('businessId') businessId: string) {
    return this.service.addFavorite(req.user.userId, businessId);
  }

  @Delete('favorites/:businessId')
  removeFavorite(@Request() req: any, @Param('businessId') businessId: string) {
    return this.service.removeFavorite(req.user.userId, businessId);
  }
}
