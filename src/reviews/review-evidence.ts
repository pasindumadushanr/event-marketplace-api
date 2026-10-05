import { PrismaService } from '../prisma/prisma.service';

// A login or a star rating is not evidence that this customer used the vendor.
export async function withReviewEvidence(
  prisma: PrismaService,
  businessId: string,
  reviews: any[],
) {
  if (!reviews.length) return [];
  const customerIds = [
    ...new Set(reviews.map((review) => review.customerId).filter(Boolean)),
  ];
  const bookings = customerIds.length
    ? await prisma.booking.findMany({
        where: {
          businessId,
          customerId: { in: customerIds },
          status: 'COMPLETED',
          date: { lte: new Date() },
        },
        select: { customerId: true, createdAt: true },
      })
    : [];
  return reviews.map((review) => ({
    ...review,
    isVerifiedCustomer: bookings.some(
      (booking) =>
        booking.customerId === review.customerId &&
        new Date(booking.createdAt) <= new Date(review.createdAt),
    ),
  }));
}
