import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorGalleryService {
  constructor(private prisma: PrismaService) {}

  async getMyBusinessId(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { id: true }
    });
    if (!business) throw new NotFoundException('Business not found.');
    return business.id;
  }

  async getGallery(vendorId: string) {
    const businessId = await this.getMyBusinessId(vendorId);
    return (this.prisma as any).gallery.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addGalleryItem(vendorId: string, url: string, type: 'IMAGE' | 'VIDEO' = 'IMAGE') {
    const businessId = await this.getMyBusinessId(vendorId);
    return (this.prisma as any).gallery.create({
      data: {
        businessId,
        url,
        type,
      }
    });
  }

  async deleteGalleryItem(vendorId: string, galleryId: string) {
    const businessId = await this.getMyBusinessId(vendorId);
    const item = await (this.prisma as any).gallery.findFirst({
      where: { id: galleryId, businessId }
    });
    
    if (!item) throw new NotFoundException('Gallery item not found.');
    
    return (this.prisma as any).gallery.delete({
      where: { id: galleryId }
    });
  }

  async setCoverImage(vendorId: string, galleryId: string) {
    const businessId = await this.getMyBusinessId(vendorId);
    const item = await (this.prisma as any).gallery.findFirst({
      where: { id: galleryId, businessId }
    });
    
    if (!item) throw new NotFoundException('Gallery item not found.');

    // First, remove cover from all other items for this business
    await (this.prisma as any).gallery.updateMany({
      where: { businessId },
      data: { isCover: false }
    });

    // Set the new cover image
    return (this.prisma as any).gallery.update({
      where: { id: galleryId },
      data: { isCover: true }
    });
  }
}
