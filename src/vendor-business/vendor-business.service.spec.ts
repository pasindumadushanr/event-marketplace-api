import { VendorBusinessService } from './vendor-business.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { profileReviewDigest } from './profile-review';

describe('VendorBusinessService', () => {
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const prisma = {
    business: { findFirst, update },
    user: { findUnique },
  } as unknown as PrismaService;
  const service = new VendorBusinessService(prisma, {} as EmailService);

  beforeEach(() => jest.resetAllMocks());

  it('loads the vendor-owned profile without selecting category hierarchy fields', async () => {
    const business = {
      id: 'business-1',
      vendorId: 'vendor-1',
      category: { name: 'Wedding Cars' },
    };
    findFirst.mockImplementation(async (query) => {
      expect(query.where).toEqual({ vendorId: 'vendor-1' });
      expect(query.include.category.select.name).toBe(true);
      expect(query.include.category.select).not.toHaveProperty('parentId');
      return business;
    });
    await expect(service.getMyBusiness('vendor-1')).resolves.toMatchObject(
      business,
    );
  });

  it('rejects invalid business coordinates before touching the database', async () => {
    await expect(
      service.updateMyBusiness('vendor-1', {
        profileSettings: { location: { latitude: 95, longitude: 80 } },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('saves or clears coordinates without losing other profile settings', async () => {
    const point = { latitude: 6.9, longitude: 79.8 };
    findFirst.mockResolvedValue({
      id: 'b1',
      profileSettings: { policies: { bookingPolicy: 'Call first' } },
    });
    update.mockResolvedValue({ id: 'b1' });
    await service.updateMyBusiness('vendor-1', {
      profileSettings: { location: point },
    });
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 'b1' },
      data: {
        profileSettings: {
          location: point,
          policies: { bookingPolicy: 'Call first' },
        },
      },
    });
    findFirst.mockResolvedValue({
      id: 'b1',
      profileSettings: {
        location: point,
        policies: { bookingPolicy: 'Call first' },
      },
    });
    await service.updateMyBusiness('vendor-1', {
      profileSettings: { location: null },
    });
    expect(update.mock.calls[1][0].data.profileSettings).toEqual({
      location: null,
      policies: { bookingPolicy: 'Call first' },
    });
  });

  it('does not fabricate a profile when onboarding has not started', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.getMyBusiness('vendor-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('preserves real database failures', async () => {
    findFirst.mockRejectedValue({ code: 'P1001' });
    await expect(service.getMyBusiness('vendor-1')).rejects.toMatchObject({
      code: 'P1001',
    });
  });

  it('does not publish drafts or approve changes made after review', async () => {
    const profile = {
      id: 'b1', name: 'Wedding Studio', description: 'Photography',
      logo: '/logo.jpg', coverImage: '/cover.jpg', address: 'Main Road',
      city: 'Colombo', phone: '0771234567', email: 'vendor@example.com',
      profileSettings: { policies: { bookingPolicy: 'Call first' }, profileReviewDigest: '' },
      vendorStatus: 'PENDING',
    };
    findFirst.mockResolvedValue(profile);
    findUnique.mockResolvedValue({ emailVerified: true });
    await expect(service.publishMyBusiness('vendor-1')).rejects.toMatchObject({ status: 403 });
    profile.vendorStatus = 'APPROVED';
    profile.profileSettings.profileReviewDigest = profileReviewDigest(profile);
    profile.description = 'Different description';
    await expect(service.publishMyBusiness('vendor-1')).rejects.toMatchObject({ status: 409 });
    expect(update).not.toHaveBeenCalled();
    profile.description = 'Photography';
    await service.publishMyBusiness('vendor-1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ACTIVE' } }));
  });

  it('reads approval separately from public visibility', async () => {
    findUnique.mockResolvedValue({ emailVerified: true });
    findFirst.mockResolvedValue({
      vendorStatus: 'APPROVED',
      rejectionReason: null,
    });
    await expect(service.getOnboardingStatus('vendor-1')).resolves.toEqual({
      vendorStatus: 'APPROVED',
      rejectionReason: null,
      emailVerified: true,
      reviewStale: false,
    });
    expect(findFirst.mock.calls[0][0].select).toEqual({
      vendorStatus: true,
      rejectionReason: true,
      informationRequest: true,
      submittedAt: true,
    });
  });
});
