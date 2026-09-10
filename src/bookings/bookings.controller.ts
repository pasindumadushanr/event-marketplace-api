import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
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
    return this.service.createBooking(req.user.id, data);
  }

  // Vendor views their incoming bookings
  @Get('vendor')
  @Roles('VENDOR')
  getVendorBookings(@Request() req: any) {
    return this.service.getVendorBookings(req.user.id);
  }

  // Vendor updates booking status
  @Patch('vendor/:id/status')
  @Roles('VENDOR')
  updateBookingStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { status: string },
  ) {
    return this.service.updateBookingStatus(req.user.id, id, data.status);
  }

  // Admin views all bookings
  @Get('admin')
  @Roles('SUPER_ADMIN', 'ADMIN')
  getAllBookings() {
    return this.service.getAllBookings();
  }

  // Admin updates booking status
  @Patch('admin/:id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  updateBookingStatusAdmin(
    @Param('id') id: string,
    @Body() data: { status: string },
  ) {
    return this.service.updateBookingStatusAdmin(id, data.status);
  }

  // Get single booking details
  @Get(':id')
  @Roles('CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN')
  getBookingById(@Request() req: any, @Param('id') id: string) {
    return this.service.getBookingById(req.user.id, id);
  }

  // Mock Payment Flow
  @Post(':id/payment/create')
  @Roles('CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN')
  createPayment(@Request() req: any, @Param('id') id: string) {
    return this.service.createMockPayment(req.user.id, id);
  }

  @Post(':id/payment/confirm')
  @Roles('CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN')
  confirmPayment(@Request() req: any, @Param('id') id: string) {
    return this.service.confirmMockPayment(req.user.id, id);
  }
}
