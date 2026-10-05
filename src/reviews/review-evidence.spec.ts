import { withReviewEvidence } from './review-evidence';
import { ReviewsService } from './reviews.service';
import { DiscoveryService } from '../discovery/discovery.service';

describe('Evidence-backed trust labels', () => {
  const reviews = [
    {
      id: 'r1',
      customerId: 'c1',
      rating: 5,
      createdAt: new Date('2026-05-01'),
    },
    {
      id: 'r2',
      customerId: 'c2',
      rating: 3,
      createdAt: new Date('2026-05-01'),
    },
  ];
  it('requires a completed past booking by the same customer, made before the review', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { customerId: 'c1', createdAt: new Date('2026-04-01') },
      { customerId: 'c2', createdAt: new Date('2026-06-01') },
    ]);
    const result = await withReviewEvidence(
      { booking: { findMany } } as any,
      'b1',
      reviews,
    );
    expect(result.map((r) => r.isVerifiedCustomer)).toEqual([true, false]);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        businessId: 'b1',
        customerId: { in: ['c1', 'c2'] },
        status: 'COMPLETED',
        date: { lte: expect.any(Date) },
      },
    });
  });
  it('does not treat a login, unmatched reviewer, or missing booking as verification', async () => {
    const prisma = { booking: { findMany: jest.fn().mockResolvedValue([]) } };
    expect(
      (await withReviewEvidence(prisma as any, 'b1', reviews))[0]
        .isVerifiedCustomer,
    ).toBe(false);
    expect(await withReviewEvidence(prisma as any, 'b1', [])).toEqual([]);
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    'displays only the recorded account email check (%s) and hides legacy flags and private documents',
    async (emailVerified) => {
      const business = {
        id: 'b1',
        isVerified: true,
        verificationDocs: 'private-id.jpg',
        vendor: { emailVerified },
        profileSettings: { verification: { isIdentityVerified: true } },
        bookings: [],
        packages: [],
        reviews: [],
      };
      const prisma = {
        business: { findFirst: jest.fn().mockResolvedValue(business) },
      };
      const result = await new DiscoveryService(prisma as any).getVendorProfile(
        'business-slug',
      );
      expect(result).toMatchObject({
        isVerified: false,
        verification: {
          isEmailVerified: emailVerified,
          isPhoneVerified: false,
          isIdentityVerified: false,
          isRegistrationVerified: false,
          isBusinessVerified: false,
        },
      });
      expect(result).not.toHaveProperty('vendor');
      expect(result).not.toHaveProperty('verificationDocs');
      expect(prisma.business.findFirst.mock.calls[0][0].include.vendor).toEqual(
        { select: { emailVerified: true } },
      );
    },
  );
  it('rejects self-reviews and fractional ratings', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ vendorId: 'v1' }) },
      review: { create: jest.fn() },
    };
    const service = new ReviewsService(prisma as any);
    await expect(
      service.createReview('v1', { businessId: 'b1', rating: 5 }),
    ).rejects.toThrow('own business');
    await expect(
      service.createReview('c1', { businessId: 'b1', rating: 4.5 }),
    ).rejects.toThrow('integer');
    expect(prisma.review.create).not.toHaveBeenCalled();
  });
  it('ignores client-supplied verification claims and classifies new reviews on the server', async () => {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ vendorId: 'v1' }) },
      review: { create: jest.fn().mockResolvedValue(reviews[0]) },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await new ReviewsService(prisma as any).createReview('c1', {
      businessId: 'b1',
      rating: 5,
      isVerifiedCustomer: true,
    } as any);
    expect(result.isVerifiedCustomer).toBe(false);
    expect(prisma.review.create.mock.calls[0][0].data).not.toHaveProperty(
      'isVerifiedCustomer',
    );
  });
});
