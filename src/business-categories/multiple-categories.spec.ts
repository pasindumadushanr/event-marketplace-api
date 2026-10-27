import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { VendorBusinessService } from '../vendor-business/vendor-business.service';
import { BusinessCategoriesService } from './business-categories.service';
import { DiscoveryService } from '../discovery/discovery.service';
import {
  prepareCategorySelection,
  businessCategoryIds,
  categoryMembershipWhere,
} from './business-category-selection';

const nodes = [
  {
    id: 'media',
    name: 'Photography & Film',
    parentId: null,
    slug: 'media',
    status: 'ACTIVE',
  },
  {
    id: 'photo',
    name: 'Photography',
    parentId: 'media',
    slug: 'photography',
    status: 'ACTIVE',
  },
  {
    id: 'video',
    name: 'Videography',
    parentId: 'media',
    slug: 'videography',
    status: 'ACTIVE',
  },
  {
    id: 'hidden',
    name: 'Retired',
    parentId: null,
    slug: 'hidden',
    status: 'INACTIVE',
  },
  {
    id: 'hidden-child',
    name: 'Hidden child',
    parentId: 'hidden',
    slug: 'hidden-child',
    status: 'ACTIVE',
  },
];
const previous = {
  id: 'business',
  categoryId: 'photo',
  category: { id: 'photo', name: 'Photography' },
  profileSettings: { policies: { bookingPolicy: 'Call first' } },
};

describe('Multiple vendor categories', () => {
  it('normalizes duplicates and always includes the primary category', () => {
    const result = prepareCategorySelection(
      { categoryIds: ['video', 'video'] },
      previous,
      nodes,
    );
    expect(result).not.toHaveProperty('categoryIds');
    expect(result.profileSettings.categoryIds).toEqual(['photo', 'video']);
    expect(businessCategoryIds({ ...previous, ...result })).toEqual([
      'photo',
      'video',
    ]);
  });
  it.each([
    null,
    'video',
    [123],
    [''],
    ['unknown'],
    ['hidden'],
    ['hidden-child'],
  ])('rejects invalid new selections: %j', (categoryIds) => {
    expect(() =>
      prepareCategorySelection({ categoryIds }, previous, nodes),
    ).toThrow(BadRequestException);
  });
  it('rejects conflicting direct JSON edits and excessive selection counts', () => {
    expect(() =>
      prepareCategorySelection(
        {
          categoryIds: ['video'],
          profileSettings: { categoryIds: ['hidden'] },
        },
        previous,
        nodes,
      ),
    ).toThrow('Conflicting');
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: `c${i}`,
      parentId: null,
      status: 'ACTIVE',
    }));
    expect(() =>
      prepareCategorySelection(
        { categoryId: 'c0', categoryIds: many.map((n) => n.id) },
        null,
        many,
      ),
    ).toThrow('at most 10');
  });
  it('removes extras explicitly without losing the primary category', () => {
    expect(
      prepareCategorySelection({ categoryIds: [] }, previous, nodes)
        .profileSettings.categoryIds,
    ).toEqual(['photo']);
  });
  it('preserves legacy single-category writes and retired assignments', () => {
    expect(
      prepareCategorySelection({ categoryId: 'photo' }, null, nodes),
    ).toEqual({ categoryId: 'photo' });
    expect(
      prepareCategorySelection(
        { categoryId: 'hidden', categoryIds: ['hidden', 'photo'] },
        { categoryId: 'hidden' },
        nodes,
      ).profileSettings.categoryIds,
    ).toEqual(['hidden', 'photo']);
  });
  it('saves vendor selections within their own profile and preserves unrelated settings', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'business' });
    const findFirst = jest.fn().mockResolvedValue(previous);
    const prisma = {
      business: { findFirst, update },
      businessCategory: { findMany: jest.fn().mockResolvedValue(nodes) },
    };
    const service = new VendorBusinessService(
      prisma as unknown as PrismaService,
      {} as EmailService,
    );
    await service.updateMyBusiness('owner', {
      categoryId: 'photo',
      categoryIds: ['photo', 'video'],
      profileSettings: { languages: 'English' },
    });
    expect(findFirst).toHaveBeenCalledWith({ where: { vendorId: 'owner' } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'business' },
      data: {
        categoryId: 'photo',
        profileSettings: {
          categoryIds: ['photo', 'video'],
          languages: 'English',
          policies: { bookingPolicy: 'Call first' },
        },
      },
    });
    await expect(
      service.updateMyBusiness('owner', {
        profileSettings: { categoryIds: ['hidden'] },
      }),
    ).rejects.toThrow('active business categories');
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('preserves additional services when an older client changes just the primary category', () => {
    const old = {
      categoryId: 'photo',
      profileSettings: { categoryIds: ['photo', 'video'] },
    };
    expect(
      prepareCategorySelection({ categoryId: 'media' }, old, nodes)
        .profileSettings.categoryIds,
    ).toEqual(['media', 'video']);
  });
  it('counts a business once per parent even if two descendants match', async () => {
    const prisma = {
      businessCategory: { findMany: jest.fn().mockResolvedValue(nodes) },
      business: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              categoryId: 'photo',
              profileSettings: { categoryIds: ['photo', 'video'] },
            },
          ]),
      },
    };
    const categories = await new BusinessCategoriesService(
      prisma as unknown as PrismaService,
    ).findAll();
    expect(categories.find((c) => c.id === 'media')?.businessCount).toBe(1);
    expect(categories.find((c) => c.id === 'photo')?.businessCount).toBe(1);
    expect(categories.find((c) => c.id === 'video')?.businessCount).toBe(1);
  });
  it('prevents deleting categories referenced only as additional services', async () => {
    const remove = jest.fn();
    const prisma = {
      businessCategory: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ _count: { businesses: 0, children: 0 } }),
        delete: remove,
      },
      business: { count: jest.fn().mockResolvedValue(1) },
    };
    await expect(
      new BusinessCategoriesService(prisma as unknown as PrismaService).delete(
        'video',
      ),
    ).rejects.toThrow('Deactivate');
    expect(prisma.business.count).toHaveBeenCalledWith({
      where: categoryMembershipWhere(['video']),
    });
    expect(remove).not.toHaveBeenCalled();
  });
  it('combines category membership with text and location filters rather than overwriting them', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      businessCategory: { findMany: jest.fn().mockResolvedValue(nodes) },
      business: { findMany, count },
    };
    await new DiscoveryService(prisma as unknown as PrismaService).search({
      categoryId: 'video',
      city: 'Colombo',
      q: 'Studio',
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.vendorStatus).toBe('APPROVED');
    expect(where.OR).toHaveLength(2);
    expect(where.AND).toEqual([categoryMembershipWhere(['video'])]);
    expect(where.city.equals).toBe('Colombo');
    expect(count).toHaveBeenCalledWith({ where });
  });
  it('returns active additional labels on public profiles, never hidden categories', async () => {
    const business = {
      ...previous,
      profileSettings: { categoryIds: ['photo', 'video', 'hidden'] },
      vendor: { emailVerified: true },
      galleries: [],
      packages: [],
      reviews: [],
      bookings: [],
    };
    const prisma = {
      business: { findFirst: jest.fn().mockResolvedValue(business) },
      businessCategory: { findMany: jest.fn().mockResolvedValue(nodes) },
    };
    const result = await new DiscoveryService(
      prisma as unknown as PrismaService,
    ).getVendorProfile('studio');
    expect(result?.categories.map((c) => c.name)).toEqual([
      'Photography',
      'Videography',
    ]);
  });
});
