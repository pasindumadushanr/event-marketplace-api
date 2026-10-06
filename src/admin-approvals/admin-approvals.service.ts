import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { INQUIRY_PREFIX, readInquiryRecord } from '../chat/inquiry-record';
import { AdminActor, recordActivity } from '../admin-activity/activity';

@Injectable()
export class AdminApprovalsService {
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

  async getApplications(status?: string) {
    return this.prisma.business.findMany({
      where: status ? { vendorStatus: status as any } : undefined,
      include: {
        vendor: { select: { firstName: true, lastName: true, email: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveApplication(id: string, actor: AdminActor) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!business) throw new NotFoundException('Application not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.business.update({
        where: { id },
        data: { vendorStatus: 'APPROVED', rejectionReason: null },
      });
      await recordActivity(
        tx,
        actor,
        'APPLICATION_APPROVED',
        'BUSINESS',
        id,
        'Vendor application approved',
      );
      return result;
    });

    // Send email notification to vendor asynchronously
    if (business.vendor && business.vendor.email) {
      this.emailService
        .sendVendorApprovalNotification(
          business.vendor.email,
          business.vendor.firstName,
        )
        .catch(console.error);
    }

    return updated;
  }

  async rejectApplication(id: string, reason: string, actor: AdminActor) {
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000)
      throw new BadRequestException(
        'Provide a rejection reason (up to 2000 characters)',
      );
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Application not found');

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.business.update({
        where: { id },
        data: { vendorStatus: 'REJECTED', rejectionReason: reason.trim() },
      });
      await recordActivity(
        tx,
        actor,
        'APPLICATION_REJECTED',
        'BUSINESS',
        id,
        'Vendor application rejected with a reason',
      );
      return result;
    });
  }
}
