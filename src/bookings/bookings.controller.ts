import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  // Customer creates a booking
  @Post()
  @Roles('CUSTOMER', 'VENDOR') // Allowing VENDOR so vendors can test it using their own accounts too
  createBooking(@Request() req: any, @Body() data: any) {
    return this.service.createBooking(req.user.userId, data);
  }

  // Vendor views their incoming bookings
  @Get('vendor')
  @Roles('VENDOR')
  getVendorBookings(@Request() req: any) {
    return this.service.getVendorBookings(req.user.userId);
  }

  // Vendor updates booking status
  @Patch('vendor/:id/status')
  @Roles('VENDOR')
  updateBookingStatus(@Request() req: any, @Param('id') id: string, @Body() data: { status: string }) {
    return this.service.updateBookingStatus(req.user.userId, id, data.status);
  }
}
