import { VendorBusinessService } from './vendor-business.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

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
    await expect(service.getMyBusiness('vendor-1')).resolves.toEqual(business);
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
    });
    expect(findFirst.mock.calls[0][0].select).toEqual({
      vendorStatus: true,
      rejectionReason: true,
      informationRequest: true,
      submittedAt: true,
    });
  });
});
