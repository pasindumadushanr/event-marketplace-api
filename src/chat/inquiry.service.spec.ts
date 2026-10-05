import { ChatService } from './chat.service';
import {
  inquiryContent,
  readInquiryRecord,
  INQUIRY_PREFIX,
} from './inquiry-record';
import { CreateInquiryDto, RespondInquiryDto } from './dto/inquiry.dto';
import { validate } from 'class-validator';

describe('Structured event enquiries', () => {
  const db: any = {
    business: { findUnique: jest.fn() },
    package: { findFirst: jest.fn() },
    conversation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  db.$transaction = (fn: any) => fn(db);
  const email = {
    sendNewMessageNotification: jest.fn().mockResolvedValue(true),
  };
  const service = new ChatService(db, email as any);
  const input = {
    businessId: 'b',
    requestId: 'i',
    eventDate: '2099-01-01',
    location: 'Colombo',
    guestCount: 150,
    requirements: 'A garden wedding with white flowers',
  };
  const response = {
    requestId: 'r',
    action: 'NEEDS_DETAILS' as const,
    text: 'What time does your event start?',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    db.business.findUnique.mockResolvedValue({
      id: 'b',
      vendorId: 'v',
      status: 'ACTIVE',
      vendorStatus: 'APPROVED',
      vendor: { email: 'v@example.com', firstName: 'Vendor' },
      profileSettings: {},
    });
    db.conversation.upsert.mockResolvedValue({ id: 'room' });
    db.conversation.findUnique.mockResolvedValue({
      customerId: 'c',
      business: { vendorId: 'v' },
    });
    db.message.findUnique.mockResolvedValue(null);
    db.message.findFirst.mockResolvedValue({
      id: 'i',
      content: inquiryContent({ kind: 'INQUIRY', ...input }),
    });
    db.message.findMany.mockResolvedValue([]);
    db.message.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, createdAt: new Date() }),
    );
  });
  it('stores all event details without creating a booking', async () => {
    const result = await service.createInquiry('c', input);
    expect(result.conversationId).toBe('room');
    expect(readInquiryRecord(result.inquiry.content)).toMatchObject({
      eventDate: input.eventDate,
      location: 'Colombo',
      guestCount: 150,
      requirements: input.requirements,
    });
    expect(email.sendNewMessageNotification).toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalled();
  });
  it('does not duplicate a saved enquiry on a retry', async () => {
    const first = await service.createInquiry('c', input);
    db.message.findUnique.mockResolvedValue(first.inquiry);
    await service.createInquiry('c', input);
    expect(db.message.create).toHaveBeenCalledTimes(1);
    expect(email.sendNewMessageNotification).toHaveBeenCalledTimes(1);
  });
  it('rejects a reference belonging to another customer', async () => {
    db.message.findUnique.mockResolvedValue({ senderId: 'outsider' });
    await expect(service.createInquiry('c', input)).rejects.toMatchObject({
      status: 400,
    });
    expect(db.message.create).not.toHaveBeenCalled();
  });
  it('rejects past dates, unavailable vendors and unrelated listings', async () => {
    await expect(
      service.createInquiry('c', { ...input, eventDate: '2020-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    db.package.findFirst.mockResolvedValue(null);
    await expect(
      service.createInquiry('c', { ...input, packageId: 'other' }),
    ).rejects.toMatchObject({ status: 400 });
    db.business.findUnique.mockResolvedValue({ status: 'INACTIVE' });
    await expect(service.createInquiry('c', input)).rejects.toMatchObject({
      status: 400,
    });
    expect(db.message.create).not.toHaveBeenCalled();
  });
  it.each(['REPLIED', 'NEEDS_DETAILS', 'DECLINED'] as const)(
    'persists vendor action %s',
    async (action) => {
      const result = await service.respondToInquiry('room', 'i', 'v', {
        ...response,
        action,
      });
      expect(readInquiryRecord(result.content)).toMatchObject({
        inquiryId: 'i',
        action,
        text: response.text,
      });
    },
  );
  it('does not allow customers or outsiders to use vendor actions', async () => {
    await expect(
      service.respondToInquiry('room', 'i', 'c', response),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.respondToInquiry('room', 'i', 'outsider', response),
    ).rejects.toMatchObject({ status: 401 });
    expect(db.message.create).not.toHaveBeenCalled();
  });
  it('does not duplicate a vendor response after a network retry', async () => {
    const first = await service.respondToInquiry('room', 'i', 'v', response);
    db.message.findUnique.mockResolvedValue(first);
    const retry = await service.respondToInquiry('room', 'i', 'v', response);
    expect(retry.id).toBe(first.id);
    expect(db.message.create).toHaveBeenCalledTimes(1);
  });
  it('keeps declines final and validates the target enquiry', async () => {
    db.message.findMany.mockResolvedValue([
      {
        content: inquiryContent({
          kind: 'RESPONSE',
          inquiryId: 'i',
          action: 'DECLINED',
          text: 'Not available',
        }),
      },
    ]);
    await expect(
      service.respondToInquiry('room', 'i', 'v', response),
    ).rejects.toMatchObject({ status: 400 });
    db.message.findFirst.mockResolvedValue(null);
    await expect(
      service.respondToInquiry('room', 'missing', 'v', response),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects forged structured messages sent as ordinary chat text', async () => {
    await expect(
      service.saveMessage('room', 'c', INQUIRY_PREFIX + '{}'),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.message.create).not.toHaveBeenCalled();
  });
  it('validates guest count, required text, UUIDs and response actions', async () => {
    const bad = Object.assign(new CreateInquiryDto(), {
      ...input,
      guestCount: 0,
      requirements: ' ',
      location: '',
    });
    expect((await validate(bad)).map((item) => item.property)).toEqual(
      expect.arrayContaining([
        'guestCount',
        'requirements',
        'location',
        'requestId',
        'businessId',
      ]),
    );
    const badResponse = Object.assign(new RespondInquiryDto(), {
      ...response,
      action: 'APPROVED',
      text: '',
    });
    expect((await validate(badResponse)).map((item) => item.property)).toEqual(
      expect.arrayContaining(['action', 'text']),
    );
  });
});
