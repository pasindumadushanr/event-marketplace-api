import {
  Injectable,
  Logger,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContactService {
  async subscribeNewsletter(dto: { email: string; consent: boolean }) {
    const email = dto.email.trim().toLowerCase();
    // Keep subscriptions in the existing private admin inbox, without a new table.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`newsletter:${email}`}))::text AS locked`;
      const existing = await tx.contactSubmission.findFirst({
        where: { email, subject: 'NEWSLETTER_SUBSCRIPTION' },
      });
      if (!existing)
        await tx.contactSubmission.create({
          data: {
            name: 'Newsletter subscriber',
            email,
            subject: 'NEWSLETTER_SUBSCRIPTION',
            message: JSON.stringify({
              consent: true,
              source: 'website-footer',
              subscribedAt: new Date().toISOString(),
            }),
          },
        });
    });
    return { success: true, message: 'Your newsletter signup has been saved.' };
  }
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @Optional() private readonly settings?: PlatformSettingsService,
  ) {}

  async submitContactForm(dto: CreateContactDto) {
    if (dto.subject === 'NEWSLETTER_SUBSCRIPTION')
      throw new BadRequestException('Use the newsletter signup form');
    // 1. Save to Database
    const submission = await (this.prisma as any).contactSubmission.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        subject: dto.subject,
        message: dto.message,
        status: 'PENDING',
      },
    });

    this.logger.log(`New contact submission saved: ${submission.id}`);

    // 2. Send Email Notifications (Async, won't block)
    // Send confirmation to the user
    await this.emailService.sendContactConfirmation(dto.email, dto.name);

    // Send notification to the admin
    let adminEmail = this.configService.get<string>(
      'SMTP_FROM_EMAIL',
      'admin@nakathata.lk',
    );
    try {
      const general = await this.settings?.read('general');
      if (general && 'contactEmail' in general)
        adminEmail = general.contactEmail;
    } catch {
      /* Keep environment fallback if the settings store is unavailable. */
    }
    await this.emailService.sendAdminContactNotification(
      adminEmail,
      dto.name,
      dto.email,
      dto.message,
    );

    return {
      success: true,
      id: submission.id,
      message: 'Message sent successfully.',
    };
  }

  // Admin: Get all tickets
  async getTickets() {
    return (this.prisma as any).contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: Update ticket status
  async updateTicketStatus(id: string, status: string) {
    return (this.prisma as any).contactSubmission.update({
      where: { id },
      data: { status },
    });
  }
}
