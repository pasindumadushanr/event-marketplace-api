import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { onlinePaymentsUnavailable } from './payments-disabled';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(_bookingId: string) {
    return onlinePaymentsUnavailable();
  }

  async processPayment(_sessionId: string, _outcome: 'SUCCESS' | 'FAILED') {
    return onlinePaymentsUnavailable();
  }

  async getSessionDetails(_sessionId: string) {
    return onlinePaymentsUnavailable();
  }

  async getAdminPayments() {
    return this.prisma.booking.findMany({
      where: { paymentStatus: 'PAID' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        business: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
