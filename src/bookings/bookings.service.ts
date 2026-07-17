import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  // For Customers
  async createBooking(customerId: string, data: any) {
    const pkg = await (this.prisma as any).package.findUnique({
      where: { id: data.packageId }
    });
    if (!pkg) throw new NotFoundException('Package not found');

    return (this.prisma as any).booking.create({
      data: {
        customerId,
        businessId: pkg.businessId,
        packageId: pkg.id,
        date: new Date(data.date),
        totalAmount: pkg.price,
        notes: data.notes,
        status: 'PENDING'
      }
    });
  }

  // For Vendors
  async getVendorBookings(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { id: true }
    });
    if (!business) throw new NotFoundException('Business not found');

    return (this.prisma as any).booking.findMany({
      where: { businessId: business.id },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        package: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // For Vendors
  async updateBookingStatus(vendorId: string, bookingId: string, status: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { id: true }
    });
    if (!business) throw new NotFoundException('Business not found');

    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId }
    });
    if (!booking) throw new NotFoundException('Booking not found');
    
    if (booking.businessId !== business.id) {
      throw new ForbiddenException('Not authorized to update this booking');
    }

    if (!['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return (this.prisma as any).booking.update({
      where: { id: bookingId },
      data: { status }
    });
  }
}
