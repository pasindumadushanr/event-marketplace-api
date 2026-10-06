import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { INQUIRY_PREFIX, readInquiryRecord } from '../chat/inquiry-record';
import { AdminActor, recordActivity } from '../admin-activity/activity';
import { readCategories } from '../business-categories/category-reader';
import { applicationQuery } from './application-query';

@Injectable()
export class AdminApprovalsService {
  private readonly logger = new Logger(AdminApprovalsService.name);
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Read-only, nationwide launch support. No approval, visibility or messaging changes.
  async getLaunchOverview(district = '', pageValue = '1') {
    if (typeof district !== 'string' || typeof pageValue !== 'string')
      throw new BadRequestException('Invalid launch filter');
    const page = Number(pageValue);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      district.length > 100
    )
      throw new BadRequestException('Invalid launch filter');
    const pageSize = 25;
    const where = district.trim()
      ? { district: { equals: district.trim(), mode: 'insensitive' as const } }
      : {};
    const [total, businesses] = await Promise.all([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          district: true,
          city: true,
          phone: true,
          email: true,
          logo: true,
          coverImage: true,
          vendorId: true,
          status: true,
          vendorStatus: true,
          category: { select: { name: true } },
          _count: {
            select: {
              galleries: true,
              packages: { where: { status: 'ACTIVE' } },
            },
          },
        },
      }),
    ]);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const conversations = businesses.length
      ? await this.prisma.conversation.findMany({
          where: {
            businessId: { in: businesses.map((b) => b.id) },
            messages: {
              some: {
                createdAt: { gte: since },
                content: { startsWith: INQUIRY_PREFIX },
              },
            },
          },
          select: {
            businessId: true,
            customerId: true,
            messages: {
              where: {
                createdAt: { gte: since },
                content: { startsWith: INQUIRY_PREFIX },
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, senderId: true, content: true },
            },
          },
        })
      : [];
    return {
      total,
      page,
      pageSize,
      windowDays: 30,
      vendors: businesses.map((business) => {
        const missing: string[] = [];
        if (!business.name.trim() || !business.description?.trim())
          missing.push('Business introduction');
        if (
          !business.logo &&
          !business.coverImage &&
          !business._count.galleries
        )
          missing.push('Photos');
        if (!business._count.packages) missing.push('Services');
        if (!business.phone?.trim() || !business.email?.trim())
          missing.push('Contact details');
        if (!business.city?.trim() || !business.district?.trim())
          missing.push('Location');
        const inquiries = {
          received: 0,
          unanswered: 0,
          replied: 0,
          needsDetails: 0,
          declined: 0,
        };
        for (const conversation of conversations.filter(
          (c) => c.businessId === business.id,
        )) {
          const latest = new Map<
            string,
            'REPLIED' | 'NEEDS_DETAILS' | 'DECLINED' | null
          >();
          for (const message of conversation.messages) {
            const record = readInquiryRecord(message.content);
            if (
              record?.kind === 'INQUIRY' &&
              message.senderId === conversation.customerId
            )
              latest.set(message.id, null);
            else if (
              record?.kind === 'RESPONSE' &&
              message.senderId === business.vendorId &&
              latest.has(record.inquiryId)
            )
              latest.set(record.inquiryId, record.action);
          }
          inquiries.received += latest.size;
          for (const action of latest.values()) {
            if (action === null) inquiries.unanswered++;
            else if (action === 'REPLIED') inquiries.replied++;
            else if (action === 'NEEDS_DETAILS') inquiries.needsDetails++;
            else inquiries.declined++;
          }
        }
        // Never return private customer messages, account data or verification documents.
        return {
          id: business.id,
          name: business.name,
          district: business.district,
          city: business.city,
          category: business.category.name,
          status: business.status,
          vendorStatus: business.vendorStatus,
          missing,
          inquiries,
        };
      }),
    };
  }

  async getApplications(input: any = {}) {
    const { rows: categories } = await readCategories(this.prisma);
    const { where, page, pageSize } = applicationQuery(input, categories);
    const count = (statuses: any[]) =>
      this.prisma.business.count({
        where: { ...where, vendorStatus: { in: statuses } },
      });
    const [total, items, pending, approved, rejected] = await Promise.all([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          district: true,
          vendorStatus: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          vendor: { select: { firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true } },
          _count: {
            select: { documents: true, galleries: true, packages: true },
          },
        },
      }),
      count(['PENDING', 'UNDER_REVIEW', 'NEEDS_INFO']),
      count(['APPROVED']),
      count(['REJECTED']),
    ]);
    return {
      total,
      page,
      pageSize,
      counts: { pending, approved, rejected },
      items: items.map((item) => ({
        ...item,
        waitingDays: this.waitingDays(item.submittedAt),
      })),
    };
  }

  private waitingDays(date: Date) {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(date).getTime()) / 86400000),
    );
  }

  async getApplication(id: string, historyPage = '1') {
    const page = Number(historyPage);
    if (
      typeof historyPage !== 'string' ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000
    )
      throw new BadRequestException('Invalid history page');
    const application = await this.prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        email: true,
        phone: true,
        website: true,
        facebook: true,
        instagram: true,
        youtube: true,
        address: true,
        city: true,
        district: true,
        province: true,
        zipCode: true,
        country: true,
        googleMapLocation: true,
        logo: true,
        coverImage: true,
        verificationDocs: true,
        isVerified: true,
        vendorStatus: true,
        status: true,
        rejectionReason: true,
        informationRequest: true,
        submittedAt: true,
        createdAt: true,
        profileSettings: true,
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            emailVerified: true,
            status: true,
          },
        },
        category: { select: { id: true, name: true } },
        galleries: { orderBy: { sortOrder: 'asc' } },
        packages: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        contentSections: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    const [items, total] = await Promise.all([
      this.prisma.applicationReviewEvent.findMany({
        where: { businessId: id },
        skip: (page - 1) * 25,
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.applicationReviewEvent.count({ where: { businessId: id } }),
    ]);
    return {
      application: {
        ...application,
        waitingDays: this.waitingDays(application.submittedAt),
      },
      history: { items, total, page, pageSize: 25 },
    };
  }

  private reviewText(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2000)
      throw new BadRequestException(
        `${label} is required (up to 2000 characters)`,
      );
    return value.trim();
  }

  async approveApplication(id: string, actor: AdminActor) {
    return this.decide(id, 'APPROVED', null, actor);
  }
  async rejectApplication(id: string, reason: string, actor: AdminActor) {
    return this.decide(
      id,
      'REJECTED',
      this.reviewText(reason, 'Rejection reason'),
      actor,
    );
  }
  async requestInformation(id: string, message: string, actor: AdminActor) {
    return this.decide(
      id,
      'NEEDS_INFO',
      this.reviewText(message, 'Information request'),
      actor,
    );
  }

  private async decide(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO',
    message: string | null,
    actor: AdminActor,
  ) {
    const event = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id },
        select: {
          id: true,
          vendorStatus: true,
          vendor: { select: { status: true } },
        },
      });
      if (!business) throw new NotFoundException('Application not found');
      if (!['UNDER_REVIEW', 'PENDING'].includes(business.vendorStatus))
        throw new ConflictException(
          'This application has changed. Reload it before reviewing.',
        );
      if (status === 'APPROVED' && business.vendor?.status !== 'ACTIVE')
        throw new BadRequestException(
          'The vendor account must be active before approval',
        );
      const changed = await tx.business.updateMany({
        where: { id, vendorStatus: business.vendorStatus },
        data: {
          vendorStatus: status,
          rejectionReason: status === 'REJECTED' ? message : null,
          informationRequest: status === 'NEEDS_INFO' ? message : null,
          // Approval is not publication. Rejected/requested applications cannot remain public.
          status: 'INACTIVE',
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Another reviewer already changed this application. Reload it.',
        );
      const action = status === 'NEEDS_INFO' ? 'INFORMATION_REQUESTED' : status;
      const review = await tx.applicationReviewEvent.create({
        data: {
          businessId: id,
          actorId: actor.id,
          actorName:
            [actor.firstName, actor.lastName].filter(Boolean).join(' ') ||
            'Administrator',
          action,
          message,
          notificationStatus: 'PENDING',
        },
      });
      await recordActivity(
        tx,
        actor,
        `APPLICATION_${action}`,
        'BUSINESS',
        id,
        status === 'NEEDS_INFO'
          ? 'Additional application information requested'
          : `Vendor application ${status.toLowerCase()}`,
      );
      return review;
    });
    return {
      eventId: event.id,
      notification: await this.deliverNotification(id, event.id),
    };
  }

  async addNote(id: string, note: string, actor: AdminActor) {
    const message = this.reviewText(note, 'Internal note');
    return this.prisma.$transaction(async (tx) => {
      if (
        !(await tx.business.findUnique({ where: { id }, select: { id: true } }))
      )
        throw new NotFoundException('Application not found');
      const event = await tx.applicationReviewEvent.create({
        data: {
          businessId: id,
          actorId: actor.id,
          actorName:
            [actor.firstName, actor.lastName].filter(Boolean).join(' ') ||
            'Administrator',
          action: 'NOTE',
          message,
        },
      });
      await recordActivity(
        tx,
        actor,
        'APPLICATION_NOTE_ADDED',
        'BUSINESS',
        id,
        'Private reviewer note added (content redacted)',
      );
      return { id: event.id };
    });
  }

  async retryNotification(id: string, eventId: string, actor: AdminActor) {
    const event = await this.prisma.applicationReviewEvent.findFirst({
      where: {
        id: eventId,
        businessId: id,
        action: { in: ['APPROVED', 'REJECTED', 'INFORMATION_REQUESTED'] },
      },
    });
    if (!event) throw new NotFoundException('Review notification not found');
    if (event.notificationStatus === 'SENT')
      throw new ConflictException('Notification was already sent');
    await this.prisma.$transaction(async (tx) => {
      await recordActivity(
        tx,
        actor,
        'APPLICATION_NOTIFICATION_RETRIED',
        'BUSINESS',
        id,
        'Review notification retry requested',
      );
    });
    return { notification: await this.deliverNotification(id, eventId) };
  }

  private async deliverNotification(id: string, eventId: string) {
    try {
      const event = await this.prisma.applicationReviewEvent.findUnique({
        where: { id: eventId },
      });
      const business = await this.prisma.business.findUnique({
        where: { id },
        select: {
          name: true,
          vendorStatus: true,
          vendor: { select: { email: true, firstName: true } },
        },
      });
      if (!event || !business?.vendor) return 'FAILED';
      // Never send a stale decision after resubmission or a later decision.
      const expected = {
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
        INFORMATION_REQUESTED: 'NEEDS_INFO',
      }[event.action];
      const latest = await this.prisma.applicationReviewEvent.findFirst({
        where: {
          businessId: id,
          action: {
            in: [
              'APPROVED',
              'REJECTED',
              'INFORMATION_REQUESTED',
              'RESUBMITTED',
            ],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (business.vendorStatus !== expected || latest?.id !== event.id) {
        await this.prisma.applicationReviewEvent.update({
          where: { id: eventId },
          data: { notificationStatus: 'SUPERSEDED' },
        });
        return 'SUPERSEDED';
      }
      const claimed = await this.prisma.applicationReviewEvent.updateMany({
        where: {
          id: eventId,
          OR: [
            { notificationStatus: { in: ['PENDING', 'FAILED'] } },
            {
              notificationStatus: 'SENDING',
              notificationAttemptAt: { lt: new Date(Date.now() - 5 * 60000) },
            },
          ],
        },
        data: {
          notificationStatus: 'SENDING',
          notificationAttemptAt: new Date(),
        },
      });
      if (!claimed.count) return event.notificationStatus;
      const sent = await this.emailService.sendVendorReviewNotification(
        business.vendor.email,
        business.vendor.firstName,
        business.name,
        event.action,
        event.message || '',
      );
      await this.prisma.applicationReviewEvent.update({
        where: { id: eventId },
        data: { notificationStatus: sent ? 'SENT' : 'FAILED' },
      });
      return sent ? 'SENT' : 'FAILED';
    } catch {
      this.logger.warn(
        'Review saved; notification delivery could not be confirmed',
      );
      // Decisions are durable even if email delivery or its status update fails.
      try {
        await this.prisma.applicationReviewEvent.update({
          where: { id: eventId },
          data: { notificationStatus: 'FAILED' },
        });
      } catch {}
      return 'FAILED';
    }
  }
}
