import 'reflect-metadata';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PaymentsService } from './payments/payments.service';
import { PaymentsController } from './payments/payments.controller';
import { BookingsService } from './bookings/bookings.service';
import { BookingsController } from './bookings/bookings.controller';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { PrismaService } from './prisma/prisma.service';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { UsersService } from './users/users.service';

describe('Launch payment lockdown', () => {
  let app: INestApplication;
  const secret = 'payment-lockdown-test-secret';
  const jwt = new JwtService({ secret });
  const previousSecret = process.env.JWT_SECRET;
  const db = {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const users = {
    findSessionById: jest.fn(async (role: string) => ({
      id: role,
      status: 'ACTIVE',
      sessionVersion: 0,
      role: { name: role },
    })),
  };
  function bearer(role = 'CUSTOMER') {
    // A forged privileged claim must never bypass the database-backed role.
    return `Bearer ${jwt.sign({ sub: role, type: 'access', sv: 0, role: 'SUPER_ADMIN' })}`;
  }
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [
        PaymentsController,
        BookingsController,
        SubscriptionsController,
      ],
      providers: [
        PaymentsService,
        BookingsService,
        SubscriptionsService,
        JwtStrategy,
        { provide: PrismaService, useValue: db },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  it.each([
    [
      'post',
      '/payments/create-session',
      { bookingId: 'another-customer-booking' },
    ],
    [
      'post',
      '/payments/process',
      { sessionId: 'old-session', outcome: 'SUCCESS' },
    ],
    [
      'post',
      '/payments/process',
      { sessionId: 'old-session', outcome: 'FAILED' },
    ],
    ['get', '/payments/session/old-session', {}],
    ['post', '/bookings/another-customer-booking/payment/create', {}],
    ['post', '/bookings/another-customer-booking/payment/confirm', {}],
    ['post', '/subscriptions/subscribe', { planId: 'paid-plan' }],
  ])('blocks %s %s without database access', async (method, path, body) => {
    const agent = request(app.getHttpServer());
    const call =
      method === 'get' ? agent.get(path as string) : agent.post(path as string);
    const response = await call
      .set('Authorization', bearer())
      .send(body)
      .expect(503);
    expect(response.body.message).toContain('not available');
    expect(db.booking.findMany).not.toHaveBeenCalled();
    // db deliberately has no mutation/session methods: any access would fail with 500.
  });
  it('also blocks anonymous legacy processing and session disclosure', async () => {
    await request(app.getHttpServer())
      .post('/payments/process')
      .send({ sessionId: 'old-session', outcome: 'SUCCESS' })
      .expect(503);
    await request(app.getHttpServer())
      .get('/payments/session/old-session')
      .expect(503);
  });
  it('rejects anonymous, customer and vendor access to the payment ledger', async () => {
    await request(app.getHttpServer()).get('/payments/admin').expect(401);
    for (const role of ['CUSTOMER', 'VENDOR']) {
      await request(app.getHttpServer())
        .get('/payments/admin')
        .set('Authorization', bearer(role))
        .expect(403);
    }
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });
  it.each(['ADMIN', 'SUPER_ADMIN'])(
    'allows %s to read the ledger',
    async (role) => {
      await request(app.getHttpServer())
        .get('/payments/admin')
        .set('Authorization', bearer(role))
        .expect(200, []);
      expect(db.booking.findMany).toHaveBeenCalledTimes(1);
    },
  );
  it('blocks direct service calls too, independent of controllers', async () => {
    const noDatabase = new Proxy(
      {},
      {
        get() {
          throw new Error('Unexpected database access');
        },
      },
    );
    const payments = new PaymentsService(noDatabase as PrismaService);
    const bookings = new BookingsService(noDatabase as PrismaService);
    const subscriptions = new SubscriptionsService(noDatabase as PrismaService);
    for (const call of [
      () => payments.createSession('booking'),
      () => payments.processPayment('session', 'SUCCESS'),
      () => payments.getSessionDetails('session'),
      () => bookings.createMockPayment('customer', 'booking'),
      () => bookings.confirmMockPayment('customer', 'booking'),
      () => subscriptions.subscribe('vendor', 'plan'),
    ])
      await expect(call()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
