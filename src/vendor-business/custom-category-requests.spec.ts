import { VendorBusinessService } from './vendor-business.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('vendor custom category requests', () => {
  const previous = {
    id: 'business',
    vendorId: 'owner',
    categoryId: 'photo',
    profileSettings: {
      policies: { bookingPolicy: 'Call first' },
      customCategoryRequests: ['Drone filming'],
    },
  };
  function setup() {
    const prisma = {
      business: {
        findFirst: jest.fn().mockResolvedValue(previous),
        update: jest.fn().mockResolvedValue(previous),
        create: jest
          .fn()
          .mockResolvedValue({ ...previous, vendorStatus: 'UNDER_REVIEW' }),
      },
      businessCategory: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'photo',
            name: 'Photography',
            slug: 'photo',
            parentId: null,
            status: 'ACTIVE',
          },
        ]),
      },
    };
    const service = new VendorBusinessService(
      prisma as unknown as PrismaService,
      {} as EmailService,
    );
    return { prisma, service };
  }
  it('saves normalized, deduplicated requests within the owner profile', async () => {
    const { service, prisma } = setup();
    await service.updateMyBusiness('owner', {
      profileSettings: {
        customCategoryRequests: [
          '  Wedding   invitations ',
          'wedding invitations',
          'මංගල ආරාධනා',
        ],
      },
    });
    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { vendorId: 'owner' },
    });
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'business' },
      data: {
        profileSettings: {
          policies: { bookingPolicy: 'Call first' },
          customCategoryRequests: ['Wedding invitations', 'මංගල ආරාධනා'],
        },
      },
    });
    expect(prisma.businessCategory.findMany).not.toHaveBeenCalled();
  });
  it.each([
    null,
    'Designer',
    {},
    [1],
    [''],
    ['a'],
    ['x'.repeat(81)],
    ['<script>bad</script>'],
    ['Bad\nName'],
    Array(6).fill('Name'),
  ])('rejects invalid requests: %j', async (customCategoryRequests) => {
    const { service, prisma } = setup();
    await expect(
      service.updateMyBusiness('owner', {
        profileSettings: { customCategoryRequests },
      }),
    ).rejects.toThrow('custom category');
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
  it('allows removing all requests without affecting other settings', async () => {
    const { service, prisma } = setup();
    await service.updateMyBusiness('owner', {
      profileSettings: { customCategoryRequests: [] },
    });
    expect(
      prisma.business.update.mock.calls[0][0].data.profileSettings,
    ).toEqual({
      policies: previous.profileSettings.policies,
      customCategoryRequests: [],
    });
  });
  it('preserves requests when an older client saves other profile fields', async () => {
    const { service, prisma } = setup();
    await service.updateMyBusiness('owner', {
      profileSettings: { languages: 'English' },
    });
    expect(
      prisma.business.update.mock.calls[0][0].data.profileSettings
        .customCategoryRequests,
    ).toEqual(['Drone filming']);
  });
  it('stores requests during onboarding without creating or approving a public category', async () => {
    const { service, prisma } = setup();
    prisma.business.findFirst.mockResolvedValue(null as any);
    jest
      .spyOn(service as any, 'notifyApplication')
      .mockResolvedValue(undefined);
    await service.submitOnboarding('owner', {
      name: 'Studio',
      categoryId: 'photo',
      profileSettings: { customCategoryRequests: ['Drone filming'] },
    });
    expect(prisma.business.create.mock.calls[0][0].data).toMatchObject({
      vendorId: 'owner',
      vendorStatus: 'PENDING',
      status: 'INACTIVE',
      categoryId: 'photo',
      profileSettings: { customCategoryRequests: ['Drone filming'] },
    });
  });
  it('keeps the required existing main category check', async () => {
    const { service } = setup();
    await expect(
      service.submitOnboarding('owner', {
        name: 'Studio',
        profileSettings: { customCategoryRequests: ['Drone filming'] },
      }),
    ).rejects.toThrow('active business category');
  });
});
