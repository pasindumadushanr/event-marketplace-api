import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorContentBuilderService {
  constructor(private prisma: PrismaService) {}

  private async getBusinessByVendorId(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
    });
    if (!business) {
      throw new NotFoundException('Business not found. Please complete onboarding.');
    }
    return business;
  }

  async getBlocks(vendorId: string) {
    const business = await this.getBusinessByVendorId(vendorId);
    return (this.prisma as any).businessContentSection.findMany({
      where: { businessId: business.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createBlock(vendorId: string, data: any) {
    const business = await this.getBusinessByVendorId(vendorId);

    // Enforce MVP limit of 10 blocks
    const blockCount = await (this.prisma as any).businessContentSection.count({
      where: { businessId: business.id },
    });

    if (blockCount >= 10) {
      throw new BadRequestException('You have reached the maximum limit of 10 custom sections.');
    }

    // Determine the next sortOrder
    const lastBlock = await (this.prisma as any).businessContentSection.findFirst({
      where: { businessId: business.id },
      orderBy: { sortOrder: 'desc' },
    });
    const nextOrder = lastBlock ? lastBlock.sortOrder + 1 : 0;

    return (this.prisma as any).businessContentSection.create({
      data: {
        ...data,
        businessId: business.id,
        sortOrder: nextOrder,
      },
    });
  }

  async updateBlock(vendorId: string, id: string, data: any) {
    const business = await this.getBusinessByVendorId(vendorId);
    
    const block = await (this.prisma as any).businessContentSection.findFirst({
      where: { id, businessId: business.id },
    });

    if (!block) {
      throw new NotFoundException('Content section not found or does not belong to you.');
    }

    return (this.prisma as any).businessContentSection.update({
      where: { id },
      data,
    });
  }

  async deleteBlock(vendorId: string, id: string) {
    const business = await this.getBusinessByVendorId(vendorId);
    
    const block = await (this.prisma as any).businessContentSection.findFirst({
      where: { id, businessId: business.id },
    });

    if (!block) {
      throw new NotFoundException('Content section not found or does not belong to you.');
    }

    return (this.prisma as any).businessContentSection.delete({
      where: { id },
    });
  }

  async reorderBlocks(vendorId: string, blockIds: string[]) {
    const business = await this.getBusinessByVendorId(vendorId);

    // Verify all blocks belong to this business
    const blocks = await (this.prisma as any).businessContentSection.findMany({
      where: {
        id: { in: blockIds },
        businessId: business.id,
      },
    });

    if (blocks.length !== blockIds.length) {
      throw new ForbiddenException('Some sections do not belong to you or do not exist.');
    }

    // Update in transaction
    const updates = blockIds.map((id, index) => {
      return (this.prisma as any).businessContentSection.update({
        where: { id },
        data: { sortOrder: index },
      });
    });

    await this.prisma.$transaction(updates);
    
    return { success: true, message: 'Blocks reordered successfully.' };
  }
}
