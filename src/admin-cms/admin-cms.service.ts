import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

@Injectable()
export class AdminCmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // Banners
  async getBanners() {
    return this.prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async getActiveBanners() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createBanner(data: any, file?: Express.Multer.File) {
    let imageUrl = data.imageUrl || '';
    if (file) {
      imageUrl = await this.storage.uploadFile(file, 'banners');
    }
    
    return this.prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        link: data.link,
        imageUrl: imageUrl,
        isActive: data.isActive === 'true' || data.isActive === true,
        sortOrder: parseInt(data.sortOrder || '0', 10)
      }
    });
  }

  async updateBanner(id: string, data: any, file?: Express.Multer.File) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    let imageUrl = banner.imageUrl;
    if (file) {
      // Delete old file if it's from cloudinary
      if (imageUrl && imageUrl.includes('cloudinary')) {
        await this.storage.deleteFile(imageUrl);
      }
      imageUrl = await this.storage.uploadFile(file, 'banners');
    } else if (data.imageUrl !== undefined) {
      imageUrl = data.imageUrl;
    }

    return this.prisma.banner.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        link: data.link,
        imageUrl,
        isActive: data.isActive !== undefined ? (data.isActive === 'true' || data.isActive === true) : undefined,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : undefined
      }
    });
  }

  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (banner && banner.imageUrl && banner.imageUrl.includes('cloudinary')) {
      await this.storage.deleteFile(banner.imageUrl);
    }
    return this.prisma.banner.delete({ where: { id } });
  }

  // FAQs
  async getFaqs() {
    return this.prisma.faq.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createFaq(data: any) {
    return this.prisma.faq.create({
      data: {
        question: data.question,
        answer: data.answer,
        category: data.category || 'GENERAL',
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder || 0
      }
    });
  }

  async updateFaq(id: string, data: any) {
    return this.prisma.faq.update({
      where: { id },
      data
    });
  }

  async deleteFaq(id: string) {
    return this.prisma.faq.delete({ where: { id } });
  }
}
