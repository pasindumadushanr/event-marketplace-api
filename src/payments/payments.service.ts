import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { package: true, business: true }
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentStatus === 'PAID') {
      throw new BadRequestException('Booking is already paid');
    }

    const sessionId = `mock_session_${uuidv4()}`;

    // Update booking with the session ID
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentSessionId: sessionId }
    });

    // In a real app, this would return a Stripe Checkout URL.
    // Here we return a local URL to our mock checkout page.
    // The frontend should handle the redirect.
    return {
      sessionId,
      url: `/checkout/mock?session_id=${sessionId}`,
      bookingDetails: {
        totalAmount: booking.totalAmount,
        packageName: booking.package?.name || 'Custom Booking',
        businessName: booking.business.name
      }
    };
  }

  async processPayment(sessionId: string, outcome: 'SUCCESS' | 'FAILED') {
    const booking = await this.prisma.booking.findFirst({
      where: { paymentSessionId: sessionId }
    });

    if (!booking) {
      throw new NotFoundException('Invalid session ID');
    }

    if (outcome === 'SUCCESS') {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED' // Automatically confirm booking when paid (for direct bookings)
        }
      });
    } else {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'FAILED'
        }
      });
    }

    return { success: true, outcome };
  }

  async getSessionDetails(sessionId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { paymentSessionId: sessionId },
      include: { package: true, business: true }
    });

    if (!booking) {
      throw new NotFoundException('Invalid session ID');
    }

    return {
      bookingId: booking.id,
      totalAmount: booking.totalAmount,
      packageName: booking.package?.name || 'Custom Booking',
      businessName: booking.business.name,
      paymentStatus: booking.paymentStatus
    };
  }

  async getAdminPayments() {
    return this.prisma.booking.findMany({
      where: { paymentStatus: 'PAID' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        business: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' } // Assuming it's marked PAID at updatedAt
    });
  }
}
