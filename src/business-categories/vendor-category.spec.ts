import { VendorBusinessService } from '../vendor-business/vendor-business.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('vendor category selection', () => {
  const business = { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() };
  const prisma = {
    business,
    businessCategory: { findMany: jest.fn().mockResolvedValue([
      { id: 'root', parentId: null, status: 'ACTIVE' },
      { id: 'service', parentId: 'root', status: 'ACTIVE' },
      { id: 'old', parentId: null, status: 'INACTIVE' },
      { id: 'hidden-child', parentId: 'old', status: 'ACTIVE' },
    ]) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    role: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = new VendorBusinessService(prisma as unknown as PrismaService, {} as EmailService);
  beforeEach(() => { jest.clearAllMocks(); business.findFirst.mockResolvedValue({ id: 'b', categoryId: 'old' }); });
  it('rejects new assignments beneath an inactive parent', async () => {
    await expect(service.updateMyBusiness('v', { categoryId: 'hidden-child' })).rejects.toThrow('active business category');
    expect(business.update).not.toHaveBeenCalled();
  });
  it('lets existing vendors retain a retired category while editing other details', async () => {
    await service.updateMyBusiness('v', { categoryId: 'old', name: 'Updated name' });
    expect(business.update).toHaveBeenCalled();
  });
  it('accepts a specific service', async () => {
    await service.updateMyBusiness('v', { categoryId: 'service' });
    expect(business.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { categoryId: 'service' } });
  });
  it('requires an active category for new vendor registration', async () => {
    await expect(service.submitOnboarding('v', { categoryId: 'old' })).rejects.toThrow('active business category');
    business.findFirst.mockResolvedValue(null);
    business.create.mockResolvedValue({ id: 'new-business' });
    await service.submitOnboarding('v', { name: 'New vendor', categoryId: 'service' });
    expect(business.create).toHaveBeenCalledWith({ data: { name: 'New vendor', categoryId: 'service', vendorId: 'v', vendorStatus: 'UNDER_REVIEW' } });
  });
});
