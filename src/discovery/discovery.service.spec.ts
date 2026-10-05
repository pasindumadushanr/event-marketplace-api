import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Discovery category search', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const nodes = [
    {
      id: 'r',
      slug: 'wedding-cars-transport',
      parentId: null,
      status: 'ACTIVE',
    },
    { id: 'c', slug: 'wedding-cars', parentId: 'r', status: 'ACTIVE' },
    { id: 's', slug: 'vintage-classic-cars', parentId: 'c', status: 'ACTIVE' },
    { id: 'hidden', slug: 'hidden', parentId: 'r', status: 'INACTIVE' },
    { id: 'cake', slug: 'wedding-cakes', parentId: null, status: 'ACTIVE' },
  ];
  const service = new DiscoveryService({
    businessCategory: { findMany: jest.fn().mockResolvedValue(nodes) },
    business: { findMany, count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService);
  beforeEach(() => jest.clearAllMocks());
  it('searches main category and descendants by slug', async () => {
    await service.search({ categorySlug: 'wedding-cars-transport' });
    expect(findMany.mock.calls[0][0].where.categoryId.in.sort()).toEqual([
      'c',
      'r',
      's',
    ]);
  });
  it('narrows to a service by ID and retains other filters', async () => {
    await service.search({ categoryId: 's', city: 'Colombo', q: 'Classic' });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      categoryId: { in: ['s'] },
      city: { equals: 'Colombo', mode: 'insensitive' },
    });
  });
  it('returns no vendors for unknown or inactive categories, not all vendors', async () => {
    await service.search({ categorySlug: 'missing' });
    expect(findMany.mock.calls[0][0].where.categoryId).toEqual({ in: [] });
    await service.search({ categoryId: 'hidden' });
    expect(findMany.mock.calls[1][0].where.categoryId).toEqual({ in: [] });
  });
  it('resolves an old broad category slug', async () => {
    await service.search({ categorySlug: 'vehicle-rental' });
    expect(findMany.mock.calls[0][0].where.categoryId.in.sort()).toEqual([
      'c',
      'r',
      's',
    ]);
  });
});
