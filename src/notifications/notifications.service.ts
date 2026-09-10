import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Get notifications for a specific user, plus any global broadcasts for their role
  async getUserNotifications(userId: string, roleName: string) {
    return this.prisma.notification.findMany({
      where: {
        OR: [
          { userId }, // direct
          { targetRole: roleName }, // role-based broadcast
          { targetRole: 'ALL' }, // global broadcast
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // Mark a notification as read
  async markAsRead(id: string, userId: string) {
    // Only works if it's a direct notification.
    // Broadcasts might need a separate read-receipt table if we want them dismissible per-user,
    // but for now we'll just let them dismiss direct ones.
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (notif && notif.userId === userId) {
      return this.prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    }
    return notif;
  }

  // Admin endpoint: broadcast to all users, specific role, or specific user
  async createBroadcast(data: {
    title: string;
    message: string;
    targetRole?: string;
    userId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        targetRole: data.targetRole || 'ALL',
        userId: data.userId || null,
      },
    });
  }

  // Admin endpoint: list all broadcasts
  async getAdminBroadcasts() {
    return this.prisma.notification.findMany({
      where: { userId: null }, // Only global/role broadcasts
      orderBy: { createdAt: 'desc' },
    });
  }
}
