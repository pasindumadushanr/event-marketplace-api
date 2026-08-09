import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const activeVendors = await this.prisma.business.count({
      where: { vendorStatus: 'APPROVED' }
    });
    const completedBookings = await this.prisma.booking.count({
      where: { status: 'COMPLETED' }
    });
    
    // Revenue from completed bookings
    const bookings = await this.prisma.booking.findMany({
      where: { status: 'COMPLETED' } // Or PAID
    });
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    // Platform cut is 10%
    const platformRevenue = totalRevenue * 0.10;

    // Get 6 months chart data for user growth
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true }
    });

    const monthlyData: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthYear = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyData[monthYear] = 0;
    }

    users.forEach(u => {
      const monthYear = u.createdAt.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (monthlyData[monthYear] !== undefined) {
        monthlyData[monthYear]++;
      }
    });

    const chartData = Object.entries(monthlyData).map(([name, total]) => ({
      name,
      total
    }));

    // Recent signups
    const recentSignups = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true }
    });

    return {
      totalUsers,
      activeVendors,
      completedBookings,
      platformRevenue,
      chartData,
      recentSignups
    };
  }
}
