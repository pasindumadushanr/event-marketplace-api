import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async submitContactForm(dto: CreateContactDto) {
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
    const adminEmail = this.configService.get<string>('SMTP_FROM_EMAIL', 'admin@luxeevents.com');
    await this.emailService.sendAdminContactNotification(
      adminEmail,
      dto.name,
      dto.email,
      dto.message
    );

    return { success: true, id: submission.id, message: 'Message sent successfully.' };
  }
}
