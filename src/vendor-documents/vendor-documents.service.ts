import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

@Injectable()
export class VendorDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async getDocuments(vendorId: string) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      return [];
    }

    return this.prisma.document.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async uploadDocument(vendorId: string, type: string, file: Express.Multer.File) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const url = await this.storage.uploadFile(file, 'documents');

    return this.prisma.document.create({
      data: {
        businessId: business.id,
        type: type || 'OTHER',
        url: url,
        status: 'PENDING'
      }
    });
  }

  async deleteDocument(vendorId: string, documentId: string) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.businessId !== business.id) {
      throw new ForbiddenException('Not authorized to delete this document');
    }

    // Delete from storage if it's on cloudinary
    if (document.url && document.url.includes('cloudinary')) {
      await this.storage.deleteFile(document.url);
    }

    return this.prisma.document.delete({
      where: { id: documentId }
    });
  }
}
