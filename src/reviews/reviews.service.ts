import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    customerId: string,
    data: { businessId: string; rating: number; comment?: string },
  ) {
    const { businessId, rating, comment } = data;

    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        businessId,
        customerId,
        rating: Math.round(numRating),
        comment: comment?.trim() || null,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    return review;
  }

  async getBusinessReviews(businessId: string) {
    return this.prisma.review.findMany({
      where: { businessId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
