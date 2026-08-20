import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addDays } from 'date-fns';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private prisma: PrismaService) {}

  // ==============================
  // ADMIN PLAN MANAGEMENT
  // ==============================

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' }
    });
  }

  async createPlan(data: any) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        durationDays: data.durationDays,
        features: data.features,
        isActive: data.isActive
      }
    });
  }

  async updatePlan(id: string, data: any) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data
    });
  }

  // ==============================
  // VENDOR SUBSCRIPTION MANAGEMENT
  // ==============================

  async getCurrentSubscription(vendorId: string) {
    return this.prisma.vendorSubscription.findFirst({
      where: { vendorId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { endDate: 'desc' }
    });
  }

  async getAllVendorSubscriptions() {
    return this.prisma.vendorSubscription.findMany({
      include: { 
        plan: true,
        vendor: {
          select: { firstName: true, lastName: true, email: true, businesses: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async subscribe(vendorId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found or inactive');
    }

    // Cancel existing active subscriptions
    await this.prisma.vendorSubscription.updateMany({
      where: { vendorId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    });

    const startDate = new Date();
    const endDate = addDays(startDate, plan.durationDays);

    return this.prisma.vendorSubscription.create({
      data: {
        vendorId,
        planId,
        status: 'ACTIVE',
        startDate,
        endDate,
        paymentStatus: 'PAID', // Auto-paid for mock flow
        paymentMethod: 'MOCK'
      }
    });
  }

  // ==============================
  // CRON JOBS
  // ==============================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpirations() {
    this.logger.debug('Running daily subscription expiration check');
    const now = new Date();

    // Find and update expired subscriptions
    const expired = await this.prisma.vendorSubscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now }
      },
      data: { status: 'EXPIRED' }
    });

    this.logger.debug(`Marked ${expired.count} subscriptions as EXPIRED`);

    // In a real app, send reminder emails for subscriptions expiring in 3 days here
  }
}
