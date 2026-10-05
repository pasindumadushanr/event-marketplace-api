import { VendorPackagesService } from './vendor-packages.service';

describe('VendorPackagesService', () => {
  const db: any = {
    business: { findFirst: jest.fn() },
    package: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const service = new VendorPackagesService(db);
  beforeEach(() => {
    jest.resetAllMocks();
    db.business.findFirst.mockResolvedValue({ id: 'b' });
    db.package.findFirst.mockResolvedValue({ id: 'p' });
  });

  it.each([undefined, '', null, 0])(
    'stores optional price %s as a quote-only listing',
    async (price) => {
      await service.createPackage('v', { name: 'Cake', price });
      expect(db.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 0 }),
        }),
      );
    },
  );
  it.each([-1, 'bad', Infinity, true, {}, 100000000])(
    'rejects invalid price %s',
    async (price) => {
      await expect(
        service.createPackage('v', { name: 'Cake', price }),
      ).rejects.toMatchObject({ status: 400 });
      expect(db.package.create).not.toHaveBeenCalled();
    },
  );
  it('keeps fixed prices and preserves prices on visibility-only edits', async () => {
    await service.createPackage('v', { name: 'Vehicle', price: '25000.50' });
    expect(db.package.create.mock.calls[0][0].data.price).toBe(25000.5);
    await service.updatePackage('v', 'p', { status: 'INACTIVE' });
    expect(db.package.update.mock.calls[0][0].data.price).toBeUndefined();
  });
  it('lets the vendor clear an existing fixed price', async () => {
    await service.updatePackage('v', 'p', { price: '' });
    expect(db.package.update.mock.calls[0][0].data.price).toBe(0);
  });
  it('does not edit listings belonging to another vendor', async () => {
    db.package.findFirst.mockResolvedValue(null);
    await expect(
      service.updatePackage('v', 'other', { price: 0 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.package.update).not.toHaveBeenCalled();
  });
});
