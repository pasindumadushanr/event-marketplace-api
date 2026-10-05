import { BookingsService } from './bookings/bookings.service';
import { bookingDay } from './bookings/booking-day';
import { ChatService } from './chat/chat.service';
import { ChatGateway } from './chat/chat.gateway';
import { VendorBusinessService } from './vendor-business/vendor-business.service';
import { DiscoveryService } from './discovery/discovery.service';
import { ContactService } from './contact/contact.service';
import { NewsletterDto } from './contact/dto/newsletter.dto';
import { validate } from 'class-validator';
import { mergeProfileSettings } from './vendor-business/profile-settings';
import { AdminCmsController } from './admin-cms/admin-cms.controller';
import { ContactController } from './contact/contact.controller';
import { HealthController } from './health/health.controller';

describe('Booking privacy and availability', () => {
  const db: any = {
    business: { findUnique: jest.fn(), findFirst: jest.fn() },
    package: { findUnique: jest.fn() },
    booking: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  db.$transaction = (callback: any) => callback(db);
  const service = new BookingsService(db);
  beforeEach(() => {
    jest.resetAllMocks();
    db.business.findUnique.mockResolvedValue({
      id: 'b',
      status: 'ACTIVE',
      vendorStatus: 'APPROVED',
      profileSettings: {},
    });
    db.package.findUnique.mockResolvedValue({
      id: 'p',
      status: 'ACTIVE',
      businessId: 'b',
      price: 100,
    });
    db.booking.count.mockResolvedValue(0);
  });
  it('rejects impossible dates', () =>
    expect(() => bookingDay('2027-02-30')).toThrow());
  it('rejects past dates before querying a package', async () => {
    await expect(
      service.createBooking('c', { date: '2020-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.package.findUnique).not.toHaveBeenCalled();
  });
  it('rejects blocked dates without creating a booking', async () => {
    db.business.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      vendorStatus: 'APPROVED',
      profileSettings: { blockedDates: ['2099-01-01'] },
    });
    await expect(
      service.createBooking('c', { packageId: 'p', date: '2099-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.booking.create).not.toHaveBeenCalled();
  });
  it('locks the vendor and refuses bookings when daily capacity is reached', async () => {
    db.booking.count.mockResolvedValue(1);
    await expect(
      service.createBooking('c', { packageId: 'p', date: '2099-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.booking.create).not.toHaveBeenCalled();
  });
  it('supports vendors with multiple teams or vehicles', async () => {
    db.business.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      vendorStatus: 'APPROVED',
      profileSettings: { maxBookingsPerDay: 3 },
    });
    db.booking.count.mockResolvedValue(2);
    await service.createBooking('c', { packageId: 'p', date: '2099-01-01' });
    expect(db.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', customerId: 'c' }),
      }),
    );
  });
  it('denies unrelated users but allows the customer, owning vendor and admin', async () => {
    db.booking.findUnique.mockResolvedValue({
      customerId: 'c',
      business: { vendorId: 'v' },
    });
    await expect(
      service.getBookingById('stranger', 'booking'),
    ).rejects.toMatchObject({ status: 403 });
    for (const [id, role] of [
      ['c', 'CUSTOMER'],
      ['v', 'VENDOR'],
      ['a', 'ADMIN'],
    ])
      await expect(
        service.getBookingById(id, 'booking', role),
      ).resolves.toBeDefined();
  });
  it('checks availability again before vendor confirmation', async () => {
    db.business.findFirst.mockResolvedValue({ id: 'b' });
    db.booking.findUnique.mockResolvedValue({
      id: 'booking',
      businessId: 'b',
      date: new Date('2099-01-01'),
    });
    db.booking.count.mockResolvedValue(1);
    await expect(
      service.updateBookingStatus('v', 'booking', 'CONFIRMED'),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.booking.update).not.toHaveBeenCalled();
  });
});

describe('Conversation authorization', () => {
  const db: any = {
    conversation: { findUnique: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  };
  const service = new ChatService(db, {} as any);
  beforeEach(() => {
    jest.resetAllMocks();
    db.conversation.findUnique.mockResolvedValue({
      customerId: 'c',
      business: { vendorId: 'v' },
    });
  });
  it('blocks outsiders from reading, writing and marking messages read regardless of role', async () => {
    await expect(
      service.getMessages('room', 'outsider', 'ADMIN'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.saveMessage('room', 'outsider', 'hello'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(service.markAsRead('room', 'outsider')).rejects.toMatchObject({
      status: 401,
    });
    expect(db.message.create).not.toHaveBeenCalled();
    expect(db.message.updateMany).not.toHaveBeenCalled();
  });
  it('allows both participants and rejects empty messages', async () => {
    await service.assertParticipant('room', 'c');
    await service.assertParticipant('room', 'v');
    await expect(service.saveMessage('room', 'c', '   ')).rejects.toMatchObject(
      { status: 400 },
    );
  });
  it('never joins a websocket room for an outsider', async () => {
    const gateway = new ChatGateway(service, {} as any);
    const client: any = {
      data: { user: { sub: 'outsider' } },
      join: jest.fn(),
    };
    await expect(
      gateway.handleJoinConversation(client, { conversationId: 'room' }),
    ).rejects.toThrow('Conversation access denied');
    expect(client.join).not.toHaveBeenCalled();
  });
});

describe('Vendor editing and approval', () => {
  const db: any = {
    business: { findFirst: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const service = new VendorBusinessService(db, {} as any);
  beforeEach(() => jest.resetAllMocks());
  it.each(['vendorId', 'vendorStatus', 'isVerified', 'status', 'id'])(
    'refuses privileged field %s',
    async (field) => {
      await expect(
        service.updateMyBusiness('v', { [field]: 'APPROVED' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(db.business.update).not.toHaveBeenCalled();
    },
  );
  it('does not publish an unapproved business', async () => {
    db.business.findFirst.mockResolvedValue({
      id: 'b',
      vendorStatus: 'UNDER_REVIEW',
    });
    await expect(service.publishMyBusiness('v')).rejects.toMatchObject({
      status: 403,
    });
    expect(db.business.update).not.toHaveBeenCalled();
  });
  it('requires verified email and complete profile details', async () => {
    db.business.findFirst.mockResolvedValue({
      id: 'b',
      vendorStatus: 'APPROVED',
    });
    db.user.findUnique.mockResolvedValue({ emailVerified: false });
    await expect(service.publishMyBusiness('v')).rejects.toMatchObject({
      status: 403,
    });
    db.user.findUnique.mockResolvedValue({ emailVerified: true });
    await expect(service.publishMyBusiness('v')).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('Search ordering across pages', () => {
  it('sorts all matching vendors before slicing the requested page', async () => {
    const rows = [90, 10, 50].map((price, i) => ({
      id: `${i}`,
      packages: [{ price }],
      reviews: [],
      createdAt: new Date(),
    }));
    const findMany = jest.fn().mockResolvedValue(rows);
    const service = new DiscoveryService({
      business: { findMany, count: jest.fn().mockResolvedValue(3) },
    } as any);
    const result = await service.search({
      page: 2,
      limit: 1,
      sortBy: 'PRICE_ASC',
    });
    expect(result.data[0].startingPrice).toBe(50);
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('skip');
    expect(findMany.mock.calls[0][0].where.vendorStatus).toBe('APPROVED');
  });
  it('rejects unbounded or invalid pagination', async () => {
    const service = new DiscoveryService({} as any);
    await expect(service.search({ limit: 10000 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.search({ page: -1 })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('Newsletter signup', () => {
  it('requires an email address and explicit consent', async () => {
    const dto = Object.assign(new NewsletterDto(), {
      email: 'bad',
      consent: false,
    });
    expect((await validate(dto)).length).toBe(2);
  });
  it('normalizes and saves consent once without sending a mock email', async () => {
    const db: any = {
      $queryRaw: jest.fn(),
      contactSubmission: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    db.$transaction = (callback: any) => callback(db);
    const service = new ContactService(db, {} as any, {} as any);
    await service.subscribeNewsletter({
      email: 'TEST@EXAMPLE.COM',
      consent: true,
    });
    expect(db.contactSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        subject: 'NEWSLETTER_SUBSCRIPTION',
      }),
    });
    db.contactSubmission.findFirst.mockResolvedValue({ id: 'existing' });
    await service.subscribeNewsletter({
      email: 'TEST@EXAMPLE.COM',
      consent: true,
    });
    expect(db.contactSubmission.create).toHaveBeenCalledTimes(1);
  });
});

describe('Private admin routes and operational checks', () => {
  it('does not expose email credentials or API keys as public CMS settings', async () => {
    const getSetting = jest.fn();
    const controller = new AdminCmsController({ getSetting } as any);
    await expect(controller.getSetting('email')).rejects.toMatchObject({
      status: 404,
    });
    await expect(controller.getSetting('apikeys')).rejects.toMatchObject({
      status: 404,
    });
    expect(getSetting).not.toHaveBeenCalled();
  });
  it('requires admin roles for support inbox reads and status changes', () => {
    for (const method of [
      ContactController.prototype.getTickets,
      ContactController.prototype.updateTicketStatus,
    ]) {
      expect(Reflect.getMetadata('roles', method)).toEqual([
        'ADMIN',
        'SUPER_ADMIN',
      ]);
      expect(Reflect.getMetadata('__guards__', method)).toHaveLength(2);
    }
  });
  it('returns unhealthy when the database cannot be reached', async () => {
    const controller = new HealthController({
      $queryRaw: jest.fn().mockRejectedValue(new Error('offline')),
    } as any);
    await expect(controller.health()).rejects.toMatchObject({ status: 503 });
  });
  it('keeps unrelated policy fields when one field is edited', () => {
    expect(
      mergeProfileSettings(
        {
          policies: { bookingPolicy: 'A', cancellationPolicy: 'B' },
          blockedDates: ['2099-01-01'],
        },
        { policies: { bookingPolicy: 'New' }, blockedDates: [] },
      ),
    ).toEqual({
      policies: { bookingPolicy: 'New', cancellationPolicy: 'B' },
      blockedDates: [],
    });
  });
});
