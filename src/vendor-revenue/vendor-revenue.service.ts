import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueStats(vendorId: string) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      return { totalRevenue: 0, completedBookings: 0, pendingPayouts: 0 };
    }

    const bookings = await this.prisma.booking.findMany({
      where: { 
        businessId: business.id,
        paymentStatus: 'PAID'
      }
    });

    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const completedBookings = bookings.filter(b => b.status === 'COMPLETED').length;
    
    // In a real app, pendingPayouts would be calculated from transfers
    // For now, we'll just consider all CONFIRMED bookings as pending payouts
    const pendingPayouts = bookings
      .filter(b => b.status === 'CONFIRMED')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    return {
      totalRevenue,
      completedBookings,
      pendingPayouts
    };
  }

  async getChartData(vendorId: string) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      return [];
    }

    // Get bookings from the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const bookings = await this.prisma.booking.findMany({
      where: { 
        businessId: business.id,
        paymentStatus: 'PAID',
        createdAt: { gte: sixMonthsAgo }
      },
      select: {
        totalAmount: true,
        createdAt: true
      }
    });

    // Group by month
    const monthlyData: Record<string, number> = {};
    
    // Initialize last 6 months with 0
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthYear = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyData[monthYear] = 0;
    }

    bookings.forEach(b => {
      const monthYear = b.createdAt.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (monthlyData[monthYear] !== undefined) {
        monthlyData[monthYear] += Number(b.totalAmount);
      }
    });

    return Object.entries(monthlyData).map(([name, revenue]) => ({
      name,
      revenue
    }));
  }
}
