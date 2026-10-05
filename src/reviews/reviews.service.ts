import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withReviewEvidence } from './review-evidence';

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
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      throw new BadRequestException(
        'Rating must be an integer between 1 and 5',
      );
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }
    if (business.vendorId === customerId)
      throw new BadRequestException('You cannot review your own business');
    if (
      comment !== undefined &&
      (typeof comment !== 'string' || comment.length > 3000)
    )
      throw new BadRequestException(
        'Review must be text of up to 3000 characters',
      );

    // Read evidence before the write: a failed lookup must not leave a
    // published review while telling the customer their submission failed.
    const [evidence] = await withReviewEvidence(this.prisma, businessId, [
      { customerId, createdAt: new Date() },
    ]);
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

    return { ...review, isVerifiedCustomer: evidence.isVerifiedCustomer };
  }

  async getBusinessReviews(businessId: string) {
    const reviews = await this.prisma.review.findMany({
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
    return withReviewEvidence(this.prisma, businessId, reviews);
  }
}
