import { CustomerAccountService } from './customer-account.service';

describe('Customer shortlist', () => {
  const business = {
    id: 'b1',
    name: 'Studio',
    city: 'Colombo',
    district: 'Colombo',
    status: 'ACTIVE',
    vendorStatus: 'APPROVED',
    packages: [
      { name: 'Full day', price: { toString: () => '50000' } },
      { name: 'Custom', price: 0 },
    ],
    reviews: [{ rating: 5 }, { rating: 4 }],
  };
  function setup(value = business) {
    const prisma = {
      favoriteBusiness: {
        findMany: jest.fn().mockResolvedValue([{ id: 'f1', business: value }]),
        upsert: jest.fn().mockResolvedValue({ id: 'f1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      business: { findFirst: jest.fn().mockResolvedValue(value) },
    };
    return { prisma, service: new CustomerAccountService(prisma as any) };
  }
  it('returns public comparison fields and calculates actual ratings and quote-only pricing', async () => {
    const { service, prisma } = setup();
    const result = await service.getFavorites('c1');
    expect(result[0].business).toMatchObject({
      services: ['Full day', 'Custom'],
      startingPrice: 0,
      hasQuoteOnlyServices: true,
      rating: 4.5,
      reviewCount: 2,
      available: true,
    });
    expect(result[0].business).not.toHaveProperty('reviews');
    expect(result[0].business).not.toHaveProperty('vendorStatus');
    const query = prisma.favoriteBusiness.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ customerId: 'c1' });
    expect(query.include.business.select.packages.where).toEqual({
      status: 'ACTIVE',
    });
    expect(query.include.business.select).not.toHaveProperty('vendor');
  });
  it('handles empty services and reviews honestly', async () => {
    const { service } = setup({ ...business, packages: [], reviews: [] });
    expect((await service.getFavorites('c1'))[0].business).toMatchObject({
      services: [],
      startingPrice: 0,
      rating: 0,
      reviewCount: 0,
    });
  });
  it('marks a removed vendor unavailable without exposing their services', async () => {
    const { service } = setup({ ...business, vendorStatus: 'PENDING' });
    expect((await service.getFavorites('c1'))[0].business).toMatchObject({
      available: false,
      services: [],
      reviewCount: 0,
    });
  });
  it('saves idempotently, requires a public vendor, and does not swallow database errors', async () => {
    const { service, prisma } = setup();
    await service.addFavorite('c1', 'b1');
    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { id: 'b1', status: 'ACTIVE', vendorStatus: 'APPROVED' },
    });
    expect(prisma.favoriteBusiness.upsert).toHaveBeenCalledWith({
      where: { customerId_businessId: { customerId: 'c1', businessId: 'b1' } },
      create: { customerId: 'c1', businessId: 'b1' },
      update: {},
    });
    prisma.favoriteBusiness.upsert.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await expect(service.addFavorite('c1', 'b1')).rejects.toThrow(
      'Database unavailable',
    );
    prisma.business.findFirst.mockResolvedValueOnce(null);
    await expect(service.addFavorite('c1', 'missing')).rejects.toThrow(
      'Business not found',
    );
  });
  it('removes only the signed-in customer’s saved vendor', async () => {
    const { service, prisma } = setup();
    await service.removeFavorite('c1', 'b1');
    expect(prisma.favoriteBusiness.deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'c1', businessId: 'b1' },
    });
  });
});
