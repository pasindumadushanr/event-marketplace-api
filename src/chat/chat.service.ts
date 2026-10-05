import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { customerId: true, business: { select: { vendorId: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (
      conversation.customerId !== userId &&
      conversation.business.vendorId !== userId
    )
      throw new UnauthorizedException('You do not belong to this conversation');
    return conversation;
  }

  // Fetch all conversations for a user
  async getUserConversations(
    userId: string,
    roleName: string,
    asVendor: boolean = false,
  ) {
    if (roleName === 'VENDOR' && asVendor) {
      // Find businesses owned by the vendor
      const business = await this.prisma.business.findFirst({
        where: { vendorId: userId },
      });
      if (!business) return [];

      return this.prisma.conversation.findMany({
        where: { businessId: business.id },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
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
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        business: {
          select: { id: true, name: true, logo: true, vendorId: true },
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { customerId, businessId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
          business: {
            select: { id: true, name: true, logo: true, vendorId: true },
          },
        },
      });
    }
    return conversation;
  }

  // Fetch messages for a conversation
  async getMessages(conversationId: string, userId: string, roleName: string) {
    await this.assertParticipant(conversationId, userId);

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Save a new message
  async saveMessage(conversationId: string, senderId: string, content: string) {
    await this.assertParticipant(conversationId, senderId);
    if (typeof content !== 'string' || !content.trim() || content.length > 5000)
      throw new BadRequestException('Messages must contain 1–5000 characters');
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: content.trim(),
      },
    });

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
      include: {
        customer: true,
        business: {
          include: { vendor: true },
        },
      },
    });

    // Check if customer is sending a message to the vendor
    if (senderId === conversation.customerId) {
      const profileSettings = conversation.business.profileSettings as any;
      // Default to true if not explicitly set to false
      const shouldEmail =
        profileSettings?.emailNotifications?.messages !== false;

      if (shouldEmail) {
        this.emailService.sendNewMessageNotification(
          conversation.business.vendor.email,
          conversation.business.vendor.firstName,
          conversation.customer.firstName,
          content,
        );
      }
    }

    return message;
  }

  // Mark messages as read
  async markAsRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
  }
}
