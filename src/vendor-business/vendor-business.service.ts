import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class VendorBusinessService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  async getMyBusiness(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      include: { category: true }
    });
    
    if (!business) {
      throw new NotFoundException('Business not found. Please complete onboarding.');
    }
    
    return business;
  }

  async submitOnboarding(vendorId: string, data: any) {
    const existing = await (this.prisma as any).business.findFirst({
      where: { vendorId }
    });
    
    if (existing) {
      throw new BadRequestException('You already have submitted an application.');
    }
    
    try {
      const business = await (this.prisma as any).business.create({
        data: {
          ...data,
          vendorId,
          vendorStatus: 'UNDER_REVIEW'
        }
      });

      // Send email notification to admin asynchronously
      const vendorUser = await (this.prisma as any).user.findUnique({ where: { id: vendorId } });
      const adminRole = await (this.prisma as any).role.findFirst({ where: { name: 'SUPER_ADMIN' } });
      
      if (adminRole && vendorUser) {
        const adminUser = await (this.prisma as any).user.findFirst({ where: { roleId: adminRole.id } });
        if (adminUser && adminUser.email) {
          this.emailService.sendNewVendorApplicationNotification(
            adminUser.email,
            `${vendorUser.firstName} ${vendorUser.lastName}`,
            business.name || 'Unknown Business'
          ).catch(console.error);
        }
      }

      return business;
    } catch (error: any) {
      console.error('Error in submitOnboarding:', error);
      throw new BadRequestException('Failed to create business: ' + error.message);
    }
  }

  async getOnboardingStatus(vendorId: string) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: vendorId },
      select: { emailVerified: true }
    });

    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { vendorStatus: true, rejectionReason: true }
    });
    
    if (!business) {
      return { 
        vendorStatus: 'NOT_STARTED',
        emailVerified: user?.emailVerified || false 
      };
    }
    
    return {
      ...business,
      emailVerified: user?.emailVerified || false
    };
  }

  async updateMyBusiness(vendorId: string, data: any) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId }
    });
    
    if (!business) {
      throw new NotFoundException('Business not found.');
    }
    
    // Merge profileSettings if provided
    if (data.profileSettings) {
      const existingSettings = (business.profileSettings as any) || {};
      data.profileSettings = {
        ...existingSettings,
        ...data.profileSettings,
      };
    }

    return (this.prisma as any).business.update({
      where: { id: business.id },
      data
    });
  }

  async publishMyBusiness(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId }
    });
    if (!business) throw new NotFoundException('Business not found.');
    return (this.prisma as any).business.update({
      where: { id: business.id },
      data: { status: 'ACTIVE' }
    });
  }

  async unpublishMyBusiness(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId }
    });
    if (!business) throw new NotFoundException('Business not found.');
    return (this.prisma as any).business.update({
      where: { id: business.id },
      data: { status: 'INACTIVE' }
    });
  }
}
