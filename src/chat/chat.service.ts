import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { bookingDay, todayInSriLanka } from '../bookings/booking-day';
import { CreateInquiryDto, RespondInquiryDto } from './dto/inquiry.dto';
import {
  INQUIRY_PREFIX,
  inquiryContent,
  readInquiryRecord,
  InquiryRecord,
} from './inquiry-record';

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
    if (content.trim().startsWith(INQUIRY_PREFIX))
      throw new BadRequestException(
        'Use the enquiry form to send event details.',
      );
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
  async createInquiry(customerId: string, data: CreateInquiryDto) {
    const day = bookingDay(data.eventDate);
    if (day.key < todayInSriLanka())
      throw new BadRequestException('Choose today or a future event date.');
    if (data.location.trim().length < 2 || data.requirements.trim().length < 10)
      throw new BadRequestException(
        'Enter the event location and requirements.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: data.businessId },
        include: { vendor: { select: { email: true, firstName: true } } },
      });
      if (
        !business ||
        business.status !== 'ACTIVE' ||
        business.vendorStatus !== 'APPROVED'
      )
        throw new BadRequestException(
          'This vendor is not accepting enquiries.',
        );
      if (business.vendorId === customerId)
        throw new BadRequestException(
          'You cannot enquire about your own business.',
        );
      let listingName: string | undefined;
      if (data.packageId) {
        const listing = await tx.package.findFirst({
          where: {
            id: data.packageId,
            businessId: business.id,
            status: 'ACTIVE',
          },
        });
        if (!listing)
          throw new BadRequestException('This listing is no longer available.');
        listingName = listing.name;
      }
      const conversation = await tx.conversation.upsert({
        where: {
          customerId_businessId: { customerId, businessId: business.id },
        },
        create: { customerId, businessId: business.id },
        update: { updatedAt: new Date() },
      });
      await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversation.id}::uuid FOR UPDATE`;
      const record: InquiryRecord = {
        kind: 'INQUIRY',
        eventDate: day.key,
        location: data.location.trim(),
        guestCount: data.guestCount,
        requirements: data.requirements.trim(),
        ...(data.packageId ? { packageId: data.packageId, listingName } : {}),
      };
      const content = inquiryContent(record);
      const previous = await tx.message.findUnique({
        where: { id: data.requestId },
      });
      if (previous) {
        if (
          previous.senderId !== customerId ||
          previous.conversationId !== conversation.id ||
          previous.content !== content
        )
          throw new BadRequestException(
            'This enquiry reference has already been used. Start a new enquiry.',
          );
        return {
          conversationId: conversation.id,
          inquiry: previous,
          business,
          duplicate: true,
        };
      }
      const inquiry = await tx.message.create({
        data: {
          id: data.requestId,
          conversationId: conversation.id,
          senderId: customerId,
          content,
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: inquiry.createdAt },
      });
      return {
        conversationId: conversation.id,
        inquiry,
        business,
        duplicate: false,
      };
    });
    const settings = result.business.profileSettings as any;
    if (!result.duplicate && settings?.emailNotifications?.messages !== false) {
      const text = `Event enquiry: ${data.eventDate}\nLocation: ${data.location}\nGuests: ${data.guestCount}\n${data.requirements}`;
      void this.emailService
        .sendNewMessageNotification(
          result.business.vendor.email,
          result.business.vendor.firstName,
          'A customer',
          text,
        )
        .catch(() => undefined);
    }
    return { conversationId: result.conversationId, inquiry: result.inquiry };
  }

  async respondToInquiry(
    conversationId: string,
    inquiryId: string,
    vendorId: string,
    data: RespondInquiryDto,
  ) {
    const conversation = await this.assertParticipant(conversationId, vendorId);
    if (conversation.business.vendorId !== vendorId)
      throw new ForbiddenException(
        'Only this vendor can respond to the enquiry.',
      );
    if (!data.text.trim())
      throw new BadRequestException('Write a message for the customer.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;
      const target = await tx.message.findFirst({
        where: {
          id: inquiryId,
          conversationId,
          senderId: conversation.customerId,
        },
      });
      if (!target || readInquiryRecord(target.content)?.kind !== 'INQUIRY')
        throw new NotFoundException('Enquiry not found.');
      const content = inquiryContent({
        kind: 'RESPONSE',
        inquiryId,
        action: data.action,
        text: data.text.trim(),
      });
      const previous = await tx.message.findUnique({
        where: { id: data.requestId },
      });
      if (previous) {
        if (
          previous.senderId !== vendorId ||
          previous.conversationId !== conversationId ||
          previous.content !== content
        )
          throw new BadRequestException(
            'This response reference has already been used.',
          );
        return previous;
      }
      const history = await tx.message.findMany({
        where: {
          conversationId,
          senderId: vendorId,
          content: { startsWith: INQUIRY_PREFIX },
        },
        orderBy: { createdAt: 'asc' },
      });
      const latest = history
        .map((message) => readInquiryRecord(message.content))
        .filter(
          (record) =>
            record?.kind === 'RESPONSE' && record.inquiryId === inquiryId,
        )
        .at(-1);
      if (latest?.kind === 'RESPONSE' && latest.action === 'DECLINED')
        throw new BadRequestException(
          'This enquiry was declined. The customer can send a new enquiry.',
        );
      const response = await tx.message.create({
        data: {
          id: data.requestId,
          conversationId,
          senderId: vendorId,
          content,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: response.createdAt },
      });
      return response;
    });
  }

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
