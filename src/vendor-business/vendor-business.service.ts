import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorBusinessService {
  constructor(private prisma: PrismaService) {}

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
      return await (this.prisma as any).business.create({
        data: {
          ...data,
          vendorId,
          vendorStatus: 'UNDER_REVIEW'
        }
      });
    } catch (error: any) {
      console.error('Error in submitOnboarding:', error);
      throw new BadRequestException('Failed to create business: ' + error.message);
    }
  }

  async getOnboardingStatus(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { vendorStatus: true, rejectionReason: true }
    });
    
    if (!business) {
      return { vendorStatus: 'NOT_STARTED' };
    }
    return business;
  }

  async updateMyBusiness(vendorId: string, data: any) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId }
    });
    
    if (!business) {
      throw new NotFoundException('Business not found.');
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
