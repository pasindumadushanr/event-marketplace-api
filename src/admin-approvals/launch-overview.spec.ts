import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BadRequestException } from '@nestjs/common';
import { AdminApprovalsService } from './admin-approvals.service';
import { AdminApprovalsController } from './admin-approvals.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { inquiryContent } from '../chat/inquiry-record';

describe('Nationwide read-only launch support', () => {
  const db: any = {
    business: { count: jest.fn(), findMany: jest.fn() },
    conversation: { findMany: jest.fn() },
  };
  const email: any = { sendVendorApprovalNotification: jest.fn() };
  const service = new AdminApprovalsService(db, email);
  const business = {
    id: 'b',
    name: 'Real vendor',
    description: 'Wedding services',
    district: 'Colombo',
    city: 'Colombo',
    phone: '0771234567',
    email: 'vendor@example.com',
    logo: 'logo.jpg',
    coverImage: null,
    vendorId: 'v',
    status: 'INACTIVE',
    vendorStatus: 'PENDING',
    category: { name: 'Photography' },
    _count: { packages: 1, galleries: 0 },
  };
  beforeEach(() => {
    jest.resetAllMocks();
    db.business.count.mockResolvedValue(26);
    db.business.findMany.mockResolvedValue([business]);
    db.conversation.findMany.mockResolvedValue([]);
  });
  it('keeps the endpoint under authenticated administrator guards', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminApprovalsController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata('roles', AdminApprovalsController)).toEqual([
      'ADMIN',
      'SUPER_ADMIN',
    ]);
  });
  it('defaults to nationwide coverage and batches 25 actual businesses', async () => {
    const result = await service.getLaunchOverview();
    expect(db.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, take: 25, skip: 0 }),
    );
    expect(result).toMatchObject({
      total: 26,
      page: 1,
      pageSize: 25,
      windowDays: 30,
    });
    expect(result.vendors[0].missing).toEqual([]);
    expect(result.vendors[0]).not.toHaveProperty('email');
    expect(result.vendors[0]).not.toHaveProperty('vendorId');
    expect(email.sendVendorApprovalNotification).not.toHaveBeenCalled();
  });
  it('filters district without narrowing the default and paginates consistently', async () => {
    await service.getLaunchOverview(' Jaffna ', '2');
    expect(db.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { district: { equals: 'Jaffna', mode: 'insensitive' } },
        skip: 25,
        take: 25,
      }),
    );
  });
  it.each(['0', '-1', '1.5', 'NaN', '10001'])(
    'rejects invalid page %s',
    async (value) => {
      await expect(service.getLaunchOverview('', value)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.business.findMany).not.toHaveBeenCalled();
    },
  );
  it('rejects oversized district filters', async () => {
    await expect(
      service.getLaunchOverview('x'.repeat(101)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects repeated or non-string filters without querying the database', async () => {
    await expect(
      service.getLaunchOverview(['Colombo', 'Jaffna'] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getLaunchOverview('', ['1', '2'] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.business.findMany).not.toHaveBeenCalled();
  });
  it('shows true missing fields without inferring approval or publication', async () => {
    db.business.findMany.mockResolvedValue([
      {
        ...business,
        description: ' ',
        logo: '',
        phone: ' ',
        district: null,
        _count: { packages: 0, galleries: 0 },
      },
    ]);
    const { vendors } = await service.getLaunchOverview();
    expect(vendors[0].missing).toEqual([
      'Business introduction',
      'Photos',
      'Services',
      'Contact details',
      'Location',
    ]);
    expect(vendors[0].vendorStatus).toBe('PENDING');
    expect(vendors[0].status).toBe('INACTIVE');
  });
  it('counts only genuine enquiries and the latest vendor action without exposing message contents', async () => {
    const inquiry = inquiryContent({
      kind: 'INQUIRY',
      eventDate: '2099-01-01',
      location: 'Private venue',
      guestCount: 20,
      requirements: 'Private requirements',
    });
    const response = (
      id: string,
      action: 'REPLIED' | 'NEEDS_DETAILS' | 'DECLINED',
    ) =>
      inquiryContent({
        kind: 'RESPONSE',
        inquiryId: id,
        action,
        text: 'Private reply',
      });
    db.conversation.findMany.mockResolvedValue([
      {
        businessId: 'b',
        customerId: 'c',
        messages: [
          { id: 'i1', senderId: 'c', content: inquiry },
          { id: 'spoof', senderId: 'v', content: inquiry },
          { id: 'i2', senderId: 'c', content: inquiry },
          { id: 'i3', senderId: 'c', content: inquiry },
          { id: 'i4', senderId: 'c', content: inquiry },
          { id: 'r1', senderId: 'v', content: response('i1', 'NEEDS_DETAILS') },
          { id: 'r2', senderId: 'v', content: response('i1', 'REPLIED') },
          { id: 'r3', senderId: 'c', content: response('i2', 'REPLIED') },
          { id: 'r4', senderId: 'v', content: response('unknown', 'REPLIED') },
          { id: 'r5', senderId: 'v', content: response('i3', 'DECLINED') },
          { id: 'r6', senderId: 'v', content: response('i4', 'NEEDS_DETAILS') },
          { id: 'legacy', senderId: 'v', content: 'Ordinary reply' },
        ],
      },
    ]);
    const result = await service.getLaunchOverview();
    expect(result.vendors[0].inquiries).toEqual({
      received: 4,
      unanswered: 1,
      replied: 1,
      declined: 1,
      needsDetails: 1,
    });
    expect(JSON.stringify(result)).not.toContain('Private');
    expect(db.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          messages: expect.objectContaining({
            where: expect.objectContaining({
              createdAt: { gte: expect.any(Date) },
            }),
          }),
        }),
      }),
    );
  });
  it('skips chat queries for an empty selection', async () => {
    db.business.count.mockResolvedValue(0);
    db.business.findMany.mockResolvedValue([]);
    expect((await service.getLaunchOverview()).vendors).toEqual([]);
    expect(db.conversation.findMany).not.toHaveBeenCalled();
  });
});
