import { readCategories } from './category-reader';
import { BusinessCategoriesService } from './business-categories.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { PrismaService } from '../prisma/prisma.service';

describe('category reads during the hierarchy rollout', () => {
  const missingParent = { code: 'P2022', meta: { column: 'BusinessCategory.parentId' } };
  const legacy = { id: 'cars', name: 'Vehicle Rental', slug: 'vehicle-rental', status: 'ACTIVE', sortOrder: 1, _count: { businesses: 3 } };
  const findMany = jest.fn();
  const search = jest.fn().mockResolvedValue([]);
  const prisma = { businessCategory: { findMany }, business: { findMany: search, count: jest.fn().mockResolvedValue(0) } } as unknown as PrismaService;
  beforeEach(() => { jest.clearAllMocks(); findMany.mockReset(); });
  it('returns existing categories when only the parentId column is missing', async () => {
    findMany.mockRejectedValueOnce(missingParent).mockResolvedValueOnce([legacy]);
    const result = await new BusinessCategoriesService(prisma).findAll();
    expect(result).toEqual([expect.objectContaining({ id: 'cars', parentId: null, businessCount: 3 })]);
    expect(findMany.mock.calls[1][0].select).not.toHaveProperty('parentId');
  });
  it('continues to use hierarchy and vendor counts after the migration', async () => {
    findMany.mockResolvedValueOnce([{ ...legacy, parentId: 'transport' }]);
    expect((await readCategories(prisma, true)).hierarchyAvailable).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
  it('does not hide database connection or unrelated column failures', async () => {
    findMany.mockRejectedValueOnce({ code: 'P1001' });
    await expect(readCategories(prisma)).rejects.toMatchObject({ code: 'P1001' });
    findMany.mockRejectedValueOnce({ code: 'P2022', meta: { column: 'BusinessCategory.name' } });
    await expect(readCategories(prisma)).rejects.toMatchObject({ code: 'P2022' });
  });
  it('keeps homepage category searches usable with the old catalog', async () => {
    findMany.mockRejectedValueOnce(missingParent).mockResolvedValueOnce([legacy]);
    await new DiscoveryService(prisma).search({ categorySlug: 'wedding-cars' });
    expect(search.mock.calls[0][0].where.categoryId).toEqual({ in: ['cars'] });
  });
});
