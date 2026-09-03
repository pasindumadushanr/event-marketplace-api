import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Fetch all conversations for a user
  async getUserConversations(userId: string, roleName: string) {
    if (roleName === 'VENDOR') {
      // Find businesses owned by the vendor
      const business = await this.prisma.business.findFirst({
        where: { vendorId: userId },
      });
      if (!business) return [];

      return this.prisma.conversation.findMany({
        where: { businessId: business.id },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    } else {
      // Customer
      return this.prisma.conversation.findMany({
        where: { customerId: userId },
        include: {
          business: {
            select: { id: true, name: true, logo: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    }
  }

  // Get or Create a conversation
  async getOrCreateConversation(customerId: string, businessId: string) {
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        customerId_businessId: { customerId, businessId },
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
        business: { select: { id: true, name: true, logo: true, vendorId: true } },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { customerId, businessId },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
          business: { select: { id: true, name: true, logo: true, vendorId: true } },
        },
      });
    }
    return conversation;
  }

  // Fetch messages for a conversation
  async getMessages(conversationId: string, userId: string, roleName: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { business: true },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    // Security check
    if (roleName === 'CUSTOMER' && conversation.customerId !== userId) {
      throw new UnauthorizedException();
    }
    if (roleName === 'VENDOR' && conversation.business.vendorId !== userId) {
      throw new UnauthorizedException();
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Save a new message
  async saveMessage(conversationId: string, senderId: string, content: string) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }
  
  // Mark messages as read
  async markAsRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });
  }
}
