import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getVendorReviews(vendorId: string) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      return [];
    }

    return this.prisma.review.findMany({
      where: { businessId: business.id },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, profileImage: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async replyToReview(vendorId: string, reviewId: string, reply: string) {
    const business = await this.prisma.business.findFirst({
      where: { vendorId },
      select: { id: true }
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.businessId !== business.id) {
      throw new ForbiddenException('Not authorized to reply to this review');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { reply }
    });
  }
}
