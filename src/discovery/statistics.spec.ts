import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Public marketplace statistics', () => {
  function setup() {
    const user = {
      count: jest.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(30),
    };
    const business = { count: jest.fn().mockResolvedValue(5) };
    const businessCategory = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'active', parentId: null, status: 'ACTIVE' },
        { id: 'hidden', parentId: null, status: 'INACTIVE' },
        { id: 'child', parentId: 'hidden', status: 'ACTIVE' },
      ]),
    };
    const service = new DiscoveryService({
      user,
      business,
      businessCategory,
    } as unknown as PrismaService);
    return { service, user, business };
  }
  it('returns only real aggregate counts and excludes hidden category branches', async () => {
    const { service, user, business } = setup();
    await expect(service.getStatistics()).resolves.toEqual({
      registeredVendors: 12,
      customerAccounts: 30,
      publishedVendors: 5,
      serviceCategories: 1,
    });
    expect(user.count).toHaveBeenNthCalledWith(1, {
      where: { status: 'ACTIVE', role: { name: 'VENDOR' } },
    });
    expect(user.count).toHaveBeenNthCalledWith(2, {
      where: { status: 'ACTIVE', role: { name: 'CUSTOMER' } },
    });
    expect(business.count).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        vendorStatus: 'APPROVED',
        vendor: { status: 'ACTIVE' },
      },
    });
  });
  it('does not invent counts when the database fails', async () => {
    const { service, business } = setup();
    business.count.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.getStatistics()).rejects.toThrow(
      'Database unavailable',
    );
  });
});
