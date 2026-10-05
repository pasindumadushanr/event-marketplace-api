import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bookingDay, todayInSriLanka } from './booking-day';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  private async assertAvailable(
    tx: any,
    businessId: string,
    day: ReturnType<typeof bookingDay>,
    excludeId?: string,
  ) {
    // Lock the vendor while checking and writing to prevent concurrent confirmations.
    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId}::uuid FOR UPDATE`;
    const business = await tx.business.findUnique({
      where: { id: businessId },
    });
    if (
      !business ||
      business.status !== 'ACTIVE' ||
      business.vendorStatus !== 'APPROVED'
    )
      throw new BadRequestException('This business is not accepting bookings');
    if (business.profileSettings?.blockedDates?.includes(day.key))
      throw new BadRequestException('The vendor is unavailable on this date');
    const booked = await tx.booking.count({
      where: {
        businessId,
        id: excludeId ? { not: excludeId } : undefined,
        date: { gte: day.date, lt: day.end },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    });
    const capacity = Number(business.profileSettings?.maxBookingsPerDay) || 1;
    if (booked >= capacity)
      throw new BadRequestException('The vendor is fully booked on this date');
  }

  // For Customers
  async createBooking(customerId: string, data: any) {
    const day = bookingDay(data.date);
    if (day.key < todayInSriLanka())
      throw new BadRequestException('Choose today or a future date');
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: data.packageId },
      });
      if (!pkg) throw new NotFoundException('Package not found');
      if (pkg.status !== 'ACTIVE')
        throw new BadRequestException('This service is not available');
      if (!Number.isFinite(Number(pkg.price)) || Number(pkg.price) <= 0)
        throw new BadRequestException(
          'This listing is priced on request. Contact the vendor for a quote before booking.',
        );
      await this.assertAvailable(tx, pkg.businessId, day);

      return tx.booking.create({
        data: {
          customerId,
          businessId: pkg.businessId,
          packageId: pkg.id,
          date: day.date,
          totalAmount: pkg.price,
          notes: data.notes,
          status: 'PENDING',
        },
      });
    });
  }

  // For Vendors
  async getVendorBookings(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    return (this.prisma as any).booking.findMany({
      where: { businessId: business.id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // For Vendors
  async updateBookingStatus(
    vendorId: string,
    bookingId: string,
    status: string,
  ) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.businessId !== business.id) {
      throw new ForbiddenException('Not authorized to update this booking');
    }

    if (!['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.$transaction(async (tx) => {
      if (status === 'CONFIRMED')
        await this.assertAvailable(
          tx,
          business.id,
          bookingDay(booking.date),
          booking.id,
        );
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: status as any },
      });
    });
  }

  // For Admins
  async getAllBookings() {
    return (this.prisma as any).booking.findMany({
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        business: {
          select: { id: true, name: true, vendor: { select: { email: true } } },
        },
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // For Admins
  async updateBookingStatusAdmin(bookingId: string, status: string) {
    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (!['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.$transaction(async (tx) => {
      if (status === 'CONFIRMED')
        await this.assertAvailable(
          tx,
          booking.businessId,
          bookingDay(booking.date),
          booking.id,
        );
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: status as any },
      });
    });
  }

  async getBookingById(userId: string, bookingId: string, roleName?: string) {
    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            city: true,
            logo: true,
            coverImage: true,
            category: { select: { name: true } },
            vendorId: true,
          },
        },
        package: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      booking.customerId !== userId &&
      booking.business.vendorId !== userId &&
      !['ADMIN', 'SUPER_ADMIN'].includes(roleName || '')
    ) {
      throw new ForbiddenException('Not authorized to view this booking');
    }
    return booking;
  }

  // Mock Payment Flow
  async createMockPayment(customerId: string, bookingId: string) {
    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return {
      checkoutUrl: `/checkout/${booking.id}`,
      paymentSessionId: `mock_sess_${Date.now()}`,
    };
  }

  async confirmMockPayment(customerId: string, bookingId: string) {
    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return (this.prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    });
  }

  // Customer cancels their own booking
  async cancelCustomerBooking(
    customerId: string,
    bookingId: string,
    reason?: string,
  ) {
    const booking = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.customerId !== customerId) {
      throw new BadRequestException(
        'You are not authorized to cancel this booking',
      );
    }

    if (booking.status === 'COMPLETED') {
      throw new BadRequestException('Completed bookings cannot be cancelled');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    const cancellationNote = reason
      ? `${booking.notes ? booking.notes + ' | ' : ''}[Customer Cancellation: ${reason}]`
      : booking.notes;

    return (this.prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        notes: cancellationNote,
      },
    });
  }
}
