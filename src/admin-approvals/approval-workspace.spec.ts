import 'reflect-metadata';
import { AdminApprovalsService } from './admin-approvals.service';
import { AdminApprovalsController } from './admin-approvals.controller';
import { applicationQuery } from './application-query';
import { EmailService } from '../email/email.service';
import { VendorBusinessService } from '../vendor-business/vendor-business.service';

const actor = {
  id: 'reviewer',
  firstName: 'Review',
  lastName: 'Team',
  role: { name: 'ADMIN' },
};
const categories: any[] = [
  { id: 'root', name: 'Photography', parentId: null, status: 'ACTIVE' },
  { id: 'child', name: 'Films', parentId: 'root', status: 'ACTIVE' },
];
function fixture() {
  const business: any = {
    id: 'b',
    name: 'Real vendor',
    vendorId: 'v',
    vendorStatus: 'UNDER_REVIEW',
    status: 'INACTIVE',
    categoryId: 'child',
    email: 'business@example.com',
    phone: '0771234567',
    submittedAt: new Date(Date.now() - 5 * 86400000),
    vendor: {
      status: 'ACTIVE',
      email: 'vendor@example.com',
      firstName: '<Vendor>',
    },
  };
  const events: any[] = [];
  const db: any = {
    businessCategory: { findMany: jest.fn().mockResolvedValue(categories) },
    business: {
      findUnique: jest.fn(async () => business),
      findFirst: jest.fn(async () => business),
      findMany: jest.fn(async () => [business]),
      count: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn(async ({ data }: any) => {
        Object.assign(business, data);
        return { count: 1 };
      }),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ firstName: 'Real', lastName: 'Vendor' }),
    },
    adminActivity: { create: jest.fn() },
    applicationReviewEvent: {
      create: jest.fn(async ({ data }: any) => {
        const event = {
          id: `event-${events.length}`,
          notificationStatus: 'NOT_REQUIRED',
          createdAt: new Date(),
          ...data,
        };
        events.unshift(event);
        return event;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        events.find((e) => e.id === where.id),
      ),
      findFirst: jest.fn(async ({ where }: any) =>
        events.find(
          (e) =>
            (!where.id || e.id === where.id) &&
            e.businessId === where.businessId &&
            where.action.in.includes(e.action),
        ),
      ),
      findMany: jest.fn(async () => events),
      count: jest.fn(async () => events.length),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(
          events.find((e) => e.id === where.id),
          data,
        ),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const event = events.find((e) => e.id === where.id);
        if (
          !event ||
          event.notificationStatus === 'SENT' ||
          event.notificationStatus === 'SENDING'
        )
          return { count: 0 };
        Object.assign(event, data);
        return { count: 1 };
      }),
    },
  };
  db.$transaction = jest.fn((fn: any) => fn(db));
  const provider = { sendMail: jest.fn().mockResolvedValue(true) };
  const email = new EmailService(provider);
  return {
    db,
    business,
    events,
    provider,
    email,
    service: new AdminApprovalsService(db, email),
  };
}
describe('Approval filters and queue', () => {
  it('includes waiting-for-information in Pending and all subcategories in category filters', () => {
    const result = applicationQuery(
      {
        district: ' Jaffna ',
        categoryId: 'root',
        q: 'cake',
        from: '2026-10-01',
        to: '2026-10-07',
        page: '2',
      },
      categories,
    );
    expect(result).toMatchObject({
      page: 2,
      pageSize: 25,
      where: {
        district: { equals: 'Jaffna', mode: 'insensitive' },
        categoryId: { in: ['root', 'child'] },
        vendorStatus: { in: ['PENDING', 'UNDER_REVIEW', 'NEEDS_INFO'] },
      },
    });
    expect(result.where.OR).toHaveLength(4);
    expect(result.where.submittedAt).toEqual({
      gte: new Date('2026-09-30T18:30:00Z'),
      lt: new Date('2026-10-07T18:30:00Z'),
    });
  });
  it.each([
    { status: 'unknown' },
    { q: ['one', 'two'] },
    { page: '0' },
    { page: '1.1' },
    { from: '2026-02-30' },
    { from: 'bad-date' },
    { from: '2026-13-01' },
    { from: '2026-10-08', to: '2026-10-07' },
    { categoryId: 'missing' },
  ])('rejects invalid filter %#', (query) =>
    expect(() => applicationQuery(query, categories)).toThrow(),
  );
  it('paginates in the database oldest first with safe account projections and waiting days', async () => {
    const { service, db } = fixture();
    const result = await service.getApplications({ page: '2' });
    expect(result.items[0].waitingDays).toBe(5);
    const query = db.business.findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      skip: 25,
      take: 25,
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    });
    expect(query.select.vendor).toEqual({
      select: { firstName: true, lastName: true, email: true },
    });
    expect(query.select).not.toHaveProperty('verificationDocs');
  });
  it('has administrator-only detail, note, review and retry routes', () => {
    expect(Reflect.getMetadata('roles', AdminApprovalsController)).toEqual([
      'ADMIN',
      'SUPER_ADMIN',
    ]);
    expect(
      Reflect.getMetadata('__guards__', AdminApprovalsController),
    ).toHaveLength(2);
  });
  it('returns a legacy array only for old frontend callers', async () => {
    const service: any = {
      getApplications: async () => ({ items: [{ id: 'b' }], total: 1 }),
    };
    const controller = new AdminApprovalsController(service);
    expect(
      await controller.getApplications({ status: 'UNDER_REVIEW' }),
    ).toEqual([{ id: 'b' }]);
    expect(await controller.getApplications({ workspace: '1' })).toHaveProperty(
      'total',
      1,
    );
  });
});
describe('Review decisions, privacy and notifications', () => {
  it('approves without publishing or awarding verification and emails correct publishing instructions', async () => {
    const { service, db, business, provider } = fixture();
    business.status = 'ACTIVE';
    const result = await service.approveApplication('b', actor);
    expect(result.notification).toBe('SENT');
    expect(business.vendorStatus).toBe('APPROVED');
    expect(business.status).toBe('INACTIVE');
    expect(db.business.updateMany.mock.calls[0][0].data).not.toHaveProperty(
      'isVerified',
    );
    expect(provider.sendMail.mock.calls[0][0]).toMatchObject({
      to: 'vendor@example.com',
    });
    expect(provider.sendMail.mock.calls[0][0].html).toContain(
      'does not publish your business automatically',
    );
  });
  it('rejects and emails an escaped reason, retaining an attributed history and redacted general audit', async () => {
    const { service, business, db, events, provider } = fixture();
    await service.rejectApplication('b', '<script>private</script>', actor);
    expect(business).toMatchObject({
      vendorStatus: 'REJECTED',
      status: 'INACTIVE',
      rejectionReason: '<script>private</script>',
    });
    expect(events[0]).toMatchObject({
      actorId: actor.id,
      actorName: 'Review Team',
      action: 'REJECTED',
      notificationStatus: 'SENT',
    });
    expect(provider.sendMail.mock.calls[0][0].html).toContain(
      '&lt;script&gt;private&lt;/script&gt;',
    );
    expect(JSON.stringify(db.adminActivity.create.mock.calls)).not.toContain(
      'private',
    );
  });
  it('requests details without rejecting, and stores the vendor-visible request', async () => {
    const { service, business, events } = fixture();
    await service.requestInformation(
      'b',
      'Upload your registration document',
      actor,
    );
    expect(business).toMatchObject({
      vendorStatus: 'NEEDS_INFO',
      informationRequest: 'Upload your registration document',
      rejectionReason: null,
      status: 'INACTIVE',
    });
    expect(events[0].action).toBe('INFORMATION_REQUESTED');
  });
  it('saves internal notes without sending or putting their contents in general audit history', async () => {
    const { service, events, db, provider } = fixture();
    await service.addNote('b', 'Private reviewer concern', actor);
    expect(events[0]).toMatchObject({
      action: 'NOTE',
      message: 'Private reviewer concern',
      notificationStatus: 'NOT_REQUIRED',
    });
    expect(provider.sendMail).not.toHaveBeenCalled();
    expect(JSON.stringify(db.adminActivity.create.mock.calls)).not.toContain(
      'Private reviewer concern',
    );
  });
  it('does not lose a decision when email fails and lets admins retry without duplicating decisions', async () => {
    const { service, provider, events, business, db } = fixture();
    provider.sendMail.mockResolvedValueOnce(false);
    expect(
      (await service.rejectApplication('b', 'Invalid registration', actor))
        .notification,
    ).toBe('FAILED');
    expect(business.vendorStatus).toBe('REJECTED');
    expect(events[0].notificationStatus).toBe('FAILED');
    expect(
      (await service.retryNotification('b', events[0].id, actor)).notification,
    ).toBe('SENT');
    expect(db.business.updateMany).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    await expect(
      service.retryNotification('b', events[0].id, actor),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('will not retry a private note as an email', async () => {
    const { service, events, provider } = fixture();
    await service.addNote('b', 'Secret note', actor);
    await expect(
      service.retryNotification('b', events[0].id, actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(provider.sendMail).not.toHaveBeenCalled();
  });
  it('suppresses an old notification after resubmission', async () => {
    const { service, provider, events, business } = fixture();
    provider.sendMail.mockResolvedValueOnce(false);
    await service.rejectApplication('b', 'Please fix', actor);
    business.vendorStatus = 'UNDER_REVIEW';
    expect(
      (await service.retryNotification('b', events[0].id, actor)).notification,
    ).toBe('SUPERSEDED');
    expect(provider.sendMail).toHaveBeenCalledTimes(1);
  });
  it('detects another reviewer’s concurrent decision and sends no notification', async () => {
    const { service, db, provider } = fixture();
    db.business.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.approveApplication('b', actor)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.applicationReviewEvent.create).not.toHaveBeenCalled();
    expect(provider.sendMail).not.toHaveBeenCalled();
  });
  it.each(['APPROVED', 'REJECTED', 'NEEDS_INFO', 'SUSPENDED'])(
    'prevents a decision on %s before resubmission',
    async (state) => {
      const { service, business, provider } = fixture();
      business.vendorStatus = state;
      await expect(
        service.approveApplication('b', actor),
      ).rejects.toMatchObject({ status: 409 });
      expect(provider.sendMail).not.toHaveBeenCalled();
    },
  );
  it('blocks approval for a suspended vendor account', async () => {
    const { service, business } = fixture();
    business.vendor.status = 'SUSPENDED';
    await expect(service.approveApplication('b', actor)).rejects.toMatchObject({
      status: 400,
    });
  });
  it.each(['', ' ', 'x'.repeat(2001)])(
    'requires a clear bounded reason/request/note %#',
    async (text) => {
      const { service, db } = fixture();
      await expect(
        service.rejectApplication('b', text, actor),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.requestInformation('b', text, actor),
      ).rejects.toMatchObject({ status: 400 });
      await expect(service.addNote('b', text, actor)).rejects.toMatchObject({
        status: 400,
      });
      expect(db.business.updateMany).not.toHaveBeenCalled();
    },
  );
  it('returns complete admin detail using safe account fields and bounded history', async () => {
    const { service, db } = fixture();
    const result = await service.getApplication('b', '2');
    expect(result.application.waitingDays).toBe(5);
    expect(db.applicationReviewEvent.findMany.mock.calls[0][0]).toMatchObject({
      skip: 25,
      take: 25,
    });
    expect(
      db.business.findUnique.mock.calls[0][0].select.vendor.select,
    ).not.toHaveProperty('password');
    await expect(service.getApplication('b', '0')).rejects.toMatchObject({
      status: 400,
    });
  });
});
describe('Vendor corrections and resubmission', () => {
  it.each(['NEEDS_INFO', 'REJECTED'])(
    'resubmits %s application under the authenticated vendor and resets queue time',
    async (state) => {
      const { db, business, email, events, provider } = fixture();
      business.vendorStatus = state;
      await new VendorBusinessService(db, email).resubmitOnboarding('v', {
        name: 'Updated business',
      });
      expect(business).toMatchObject({
        vendorStatus: 'UNDER_REVIEW',
        status: 'INACTIVE',
        rejectionReason: null,
        informationRequest: null,
        name: 'Updated business',
      });
      expect(business.submittedAt.getTime()).toBeGreaterThan(
        Date.now() - 10000,
      );
      expect(db.business.updateMany.mock.calls[0][0].where).toEqual({
        id: 'b',
        vendorId: 'v',
        vendorStatus: state,
      });
      expect(events[0]).toMatchObject({ action: 'RESUBMITTED', actorId: 'v' });
      expect(provider.sendMail.mock.calls[0][0].to).toBe(
        'admineventmarketplace@gmail.com',
      );
    },
  );
  it('rejects privileged fields and duplicate resubmission of an approved application', async () => {
    const { db, business, email } = fixture();
    const service = new VendorBusinessService(db, email);
    await expect(
      service.resubmitOnboarding('v', { vendorStatus: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 400 });
    business.vendorStatus = 'APPROVED';
    await expect(
      service.resubmitOnboarding('v', { name: 'Hello' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.business.updateMany).not.toHaveBeenCalled();
  });
});
