import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { isCategoryActive } from '../business-categories/category-tree';
import { readCategories } from '../business-categories/category-reader';
import { mergeProfileSettings } from './profile-settings';
import { coordinates } from '../discovery/geo';

@Injectable()
export class VendorBusinessService {
  private readonly logger = new Logger(VendorBusinessService.name);
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private editableData(data: Record<string, unknown>) {
    const fields = [
      'name',
      'description',
      'phone',
      'email',
      'website',
      'facebook',
      'instagram',
      'youtube',
      'address',
      'city',
      'district',
      'province',
      'zipCode',
      'country',
      'googleMapLocation',
      'logo',
      'coverImage',
      'categoryId',
      'verificationDocs',
      'profileSettings',
    ];
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new BadRequestException('Invalid business details');
    if (Object.keys(data).some((key) => !fields.includes(key)))
      throw new BadRequestException(
        'Only business profile fields can be edited',
      );
    for (const [key, value] of Object.entries(data)) {
      if (
        key !== 'profileSettings' &&
        value !== null &&
        typeof value !== 'string'
      )
        throw new BadRequestException(`${key} must be text`);
    }
    if ('name' in data && !String(data.name || '').trim())
      throw new BadRequestException('Business name is required');
    if (
      data.profileSettings !== undefined &&
      (!data.profileSettings ||
        typeof data.profileSettings !== 'object' ||
        Array.isArray(data.profileSettings))
    )
      throw new BadRequestException('Invalid profile settings');
    const settings = data.profileSettings as any;
    if (
      settings &&
      'location' in settings &&
      settings.location !== null &&
      !coordinates(settings.location)
    )
      throw new BadRequestException(
        'Business coordinates must be valid latitude and longitude numbers',
      );
    if (settings && JSON.stringify(settings).length > 100000)
      throw new BadRequestException('Profile settings are too large');
    if (
      settings?.maxBookingsPerDay !== undefined &&
      (!Number.isInteger(settings.maxBookingsPerDay) ||
        settings.maxBookingsPerDay < 1 ||
        settings.maxBookingsPerDay > 100)
    )
      throw new BadRequestException(
        'Daily booking capacity must be between 1 and 100',
      );
    if (
      settings?.blockedDates !== undefined &&
      (!Array.isArray(settings.blockedDates) ||
        settings.blockedDates.some(
          (day: unknown) =>
            typeof day !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
            Number.isNaN(Date.parse(day)),
        ))
    )
      throw new BadRequestException('Blocked dates must use YYYY-MM-DD');
    if (
      settings?.seo?.slug &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(settings.seo.slug)
    )
      throw new BadRequestException(
        'Use a lowercase business URL with hyphens',
      );
    return { ...data } as any;
  }

  async getMyBusiness(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      // Only display fields are needed here, not the category hierarchy column.
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
            coverImage: true,
            sortOrder: true,
            isFeatured: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException(
        'Business not found. Please complete onboarding.',
      );
    }

    return business;
  }

  async submitOnboarding(vendorId: string, data: any) {
    data = this.editableData(data);
    const { rows: categories } = await readCategories(this.prisma);
    if (!isCategoryActive(categories, data.categoryId))
      throw new BadRequestException('Choose an active business category.');
    const existing = await (this.prisma as any).business.findFirst({
      where: { vendorId },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have submitted an application.',
      );
    }

    let business: any;
    try {
      business = await (this.prisma as any).business.create({
        data: {
          ...data,
          vendorId,
          vendorStatus: 'UNDER_REVIEW',
          status: 'INACTIVE',
          submittedAt: new Date(),
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to save vendor application');
      throw new BadRequestException(
        'Failed to create business: ' + error.message,
      );
    }

    await this.notifyApplication(vendorId, business, categories);
    return business;
  }

  private async notifyApplication(
    vendorId: string,
    business: any,
    categories: any[],
  ) {
    // Notify only after the application is saved. Email failures must never
    // report a saved application as failed or encourage duplicate submissions.
    try {
      const vendorUser = await (this.prisma as any).user.findUnique({
        where: { id: vendorId },
        select: { firstName: true, lastName: true },
      });
      const sent = await this.emailService.sendNewVendorApplicationNotification(
        'admineventmarketplace@gmail.com',
        [vendorUser?.firstName, vendorUser?.lastName]
          .filter(Boolean)
          .join(' ') || 'Vendor',
        business.name,
        {
          applicationId: business.id,
          category:
            categories.find((category) => category.id === business.categoryId)
              ?.name || 'Not provided',
          location:
            [business.city, business.district].filter(Boolean).join(', ') ||
            'Not provided',
          email: business.email || 'Not provided',
          phone: business.phone || 'Not provided',
        },
      );
      if (!sent)
        this.logger.warn(
          `Application ${business.id} saved, but admin email delivery failed. Review it in Vendor Approvals.`,
        );
    } catch (error: any) {
      this.logger.warn(
        `Application ${business.id} saved, but admin notification failed. Review it in Vendor Approvals.`,
      );
    }
  }

  async resubmitOnboarding(vendorId: string, data: any) {
    data = this.editableData(data);
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
    });
    if (!business) throw new NotFoundException('Application not found');
    if (!['NEEDS_INFO', 'REJECTED'].includes(business.vendorStatus))
      throw new ConflictException(
        'Only applications needing changes can be resubmitted',
      );
    const { rows: categories } = await readCategories(this.prisma);
    if (!isCategoryActive(categories, data.categoryId || business.categoryId))
      throw new BadRequestException('Choose an active business category');
    const updated = { ...business, ...data };
    if (
      ![updated.name, updated.phone, updated.email].every(
        (value) => typeof value === 'string' && value.trim(),
      )
    )
      throw new BadRequestException(
        'Business name, email and phone are required',
      );
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorId },
      select: { firstName: true, lastName: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.business.updateMany({
        where: {
          id: business.id,
          vendorId,
          vendorStatus: business.vendorStatus,
        },
        data: {
          ...data,
          vendorStatus: 'UNDER_REVIEW',
          status: 'INACTIVE',
          rejectionReason: null,
          informationRequest: null,
          submittedAt: new Date(),
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Your application changed. Reload before resubmitting',
        );
      await tx.applicationReviewEvent.create({
        data: {
          businessId: business.id,
          actorId: vendorId,
          actorName:
            [vendor?.firstName, vendor?.lastName].filter(Boolean).join(' ') ||
            'Vendor',
          action: 'RESUBMITTED',
        },
      });
    });
    await this.notifyApplication(vendorId, updated, categories);
    return { message: 'Application resubmitted for review' };
  }

  async getOnboardingStatus(vendorId: string) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: vendorId },
      select: { emailVerified: true },
    });

    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: {
        vendorStatus: true,
        rejectionReason: true,
        informationRequest: true,
        submittedAt: true,
      },
    });

    if (!business) {
      return {
        vendorStatus: 'NOT_STARTED',
        emailVerified: user?.emailVerified || false,
      };
    }

    return {
      ...business,
      emailVerified: user?.emailVerified || false,
    };
  }

  async updateMyBusiness(vendorId: string, data: any) {
    data = this.editableData(data);
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    // Merge profileSettings if provided
    if (
      data.categoryId !== undefined &&
      data.categoryId !== business.categoryId
    ) {
      const { rows: categories } = await readCategories(this.prisma);
      if (!isCategoryActive(categories, data.categoryId))
        throw new BadRequestException('Choose an active business category.');
    }
    if (data.profileSettings) {
      const existingSettings = business.profileSettings || {};
      data.profileSettings = mergeProfileSettings(
        existingSettings,
        data.profileSettings,
      );
      const slug = data.profileSettings.seo?.slug;
      if (slug) {
        const duplicate = await this.prisma.business.findFirst({
          where: {
            id: { not: business.id },
            profileSettings: { path: ['seo', 'slug'], equals: slug },
          },
          select: { id: true },
        });
        if (duplicate)
          throw new BadRequestException('That business URL is already in use');
      }
    }

    return (this.prisma as any).business.update({
      where: { id: business.id },
      data,
    });
  }

  async publishMyBusiness(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
    });
    if (!business) throw new NotFoundException('Business not found.');
    if (business.vendorStatus !== 'APPROVED')
      throw new ForbiddenException(
        'Your application must be approved before publishing',
      );
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorId },
      select: { emailVerified: true },
    });
    if (!vendor?.emailVerified)
      throw new ForbiddenException('Verify your email before publishing');
    if (
      ![
        business.name,
        business.description,
        business.logo,
        business.coverImage,
        business.phone,
        business.email,
        business.address,
        business.city,
        business.profileSettings?.policies?.bookingPolicy,
      ].every((value) => typeof value === 'string' && value.trim())
    )
      throw new BadRequestException(
        'Complete your business details, photos, contact, location and booking policy before publishing',
      );
    return (this.prisma as any).business.update({
      where: { id: business.id },
      data: { status: 'ACTIVE' },
    });
  }

  async unpublishMyBusiness(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
    });
    if (!business) throw new NotFoundException('Business not found.');
    return (this.prisma as any).business.update({
      where: { id: business.id },
      data: { status: 'INACTIVE' },
    });
  }
}
