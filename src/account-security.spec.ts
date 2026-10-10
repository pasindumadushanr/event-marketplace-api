import 'reflect-metadata';
import { UsersService } from './users/users.service';
import { UsersController } from './users/users.controller';
import { safeUserSelect } from './users/safe-user';
import { assertSession } from './auth/session';
import { AuthService } from './auth/auth.service';
import { AdminApprovalsService } from './admin-approvals/admin-approvals.service';
import { AdminCmsService } from './admin-cms/admin-cms.service';
import { AdminActivityController } from './admin-activity/admin-activity.controller';
import { ChatGateway } from './chat/chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { EmailService } from './email/email.service';
import { STORAGE_PROVIDER } from './common/providers/storage.provider';

const actor = {
  id: 'admin',
  firstName: 'Review',
  lastName: 'Admin',
  role: { name: 'SUPER_ADMIN' },
};
function database() {
  const db: any = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    business: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'business',
        vendorStatus: 'UNDER_REVIEW',
        vendor: { status: 'ACTIVE' },
      }),
      update: jest.fn().mockResolvedValue({ id: 'business' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    applicationReviewEvent: {
      create: jest.fn().mockResolvedValue({ id: 'review' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    setting: {
      upsert: jest
        .fn()
        .mockResolvedValue({ value: { secret: 'must-not-be-logged' } }),
    },
    adminActivity: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(26),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  db.$transaction = jest.fn((fn: any) => fn(db));
  return db;
}

describe('Safe account lookup', () => {
  it.each(['findById', 'findByEmail', 'findAll'] as const)(
    '%s is administrator-only and uses two guards',
    (method) => {
      expect(
        Reflect.getMetadata('roles', UsersController.prototype[method]),
      ).toEqual(expect.arrayContaining(['ADMIN', 'SUPER_ADMIN']));
      expect(
        Reflect.getMetadata('__guards__', UsersController.prototype[method]),
      ).toHaveLength(2);
    },
  );
  it.each([
    'password',
    'emailVerificationOtp',
    'emailVerificationOtpExpiry',
    'hashedRefreshToken',
    'sessionVersion',
    'otpPurpose',
    'googleId',
  ])('never selects %s for public account queries', (field) => {
    expect(safeUserSelect).not.toHaveProperty(field);
  });
  it('uses an explicit safe projection for every lookup and account list', async () => {
    const db = database();
    const service = new UsersService(db);
    await service.findById('u');
    await service.findByEmail('u@example.com');
    await service.findAll();
    for (const [query] of db.user.findUnique.mock.calls)
      expect(query.select).toEqual(safeUserSelect);
    expect(db.user.findMany.mock.calls[0][0].select).toMatchObject(
      safeUserSelect,
    );
    expect(db.user.findMany.mock.calls[0][0]).not.toHaveProperty('include');
  });
  it('refuses the old password-change shortcut', async () => {
    const db = database();
    await expect(
      new UsersService(db).updateMe('u', { password: 'attacker' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe('Session revocation', () => {
  const user = { status: 'ACTIVE', sessionVersion: 4 };
  it('accepts a current access token', () =>
    expect(() => assertSession({ type: 'access', sv: 4 }, user)).not.toThrow());
  it.each([
    [{ type: 'access', sv: 3 }, user],
    [{ type: 'refresh', sv: 4 }, user],
    [{}, user],
    [{ type: 'access', sv: '4' }, user],
    [{ type: 'access', sv: 4 }, null],
    [
      { type: 'access', sv: 4 },
      { ...user, status: 'SUSPENDED' },
    ],
    [
      { type: 'access', sv: 4 },
      { ...user, status: 'INACTIVE' },
    ],
  ])(
    'rejects revoked, suspended, deleted, refresh and legacy sessions %#',
    (payload, account) => {
      expect(() => assertSession(payload, account)).toThrow('Session expired');
    },
  );
  it('logout-all advances the version and clears every reusable credential', async () => {
    const db = database();
    await new UsersService(db).logoutAllDevices('u');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u' },
      data: {
        sessionVersion: { increment: 1 },
        hashedRefreshToken: null,
        otpPurpose: null,
        emailVerificationOtp: null,
        emailVerificationOtpExpiry: null,
      },
    });
  });
  it('suspension revokes tokens and writes an activity record in one transaction', async () => {
    const db = database();
    await new UsersService(db).updateStatus('u', 'SUSPENDED', actor);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      status: 'SUSPENDED',
      sessionVersion: { increment: 1 },
      hashedRefreshToken: null,
    });
    expect(db.adminActivity.create.mock.calls[0][0].data).toMatchObject({
      actorId: actor.id,
      action: 'USER_STATUS_CHANGED',
      targetId: 'u',
    });
  });
  it('cannot suspend the acting administrator or accept an arbitrary status', async () => {
    const db = database();
    const service = new UsersService(db);
    await expect(
      service.updateStatus(actor.id, 'SUSPENDED', actor),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.updateStatus('u', 'ADMIN', actor),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('issues distinct access and refresh token types with the current version', async () => {
    const jwt = new JwtService({ secret: 'test-only-not-for-production' });
    const users: any = {
      findSessionById: jest
        .fn()
        .mockResolvedValue({ ...user, role: { name: 'VENDOR' } }),
      updateRefreshToken: jest.fn(),
    };
    const result = await new AuthService(
      users,
      jwt,
      {} as any,
      {} as any,
    ).generateTokens('u', 'u@example.com', 'VENDOR', 'User', 'Test');
    expect(jwt.verify(result.accessToken)).toMatchObject({
      sub: 'u',
      type: 'access',
      sv: 4,
      role: 'VENDOR',
    });
    expect(jwt.verify(result.refreshToken)).toMatchObject({
      type: 'refresh',
      sv: 4,
    });
  });
  it('rejects suspended accounts before verifying their password', async () => {
    const service = new AuthService(
      { findAuthByEmail: async () => ({ status: 'SUSPENDED' }) } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.login({ email: 'u@example.com', password: 'password' }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('does not accept a password-reset code as an admin login code', async () => {
    const service = new AuthService(
      {
        findAuthById: async () => ({
          status: 'ACTIVE',
          role: { name: 'ADMIN' },
          otpPurpose: 'RESET_PASSWORD',
          emailVerificationOtp: '123456',
          emailVerificationOtpExpiry: new Date(Date.now() + 60000),
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.verifyAdminLoginOtp('a', '123456'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('does not let administrators bypass email verification with Google login', async () => {
    const service = new AuthService(
      {
        findAuthByEmail: async () => ({
          status: 'ACTIVE',
          role: { name: 'ADMIN' },
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.validateOAuthLogin({ email: 'a@example.com' }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('consumes admin OTPs atomically and rejects already-used codes', async () => {
    const db = database();
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      new UsersService(db).consumeOtp('u', 'ADMIN_LOGIN', '123456'),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.updateMany.mock.calls[0][0].where).toMatchObject({
      status: 'ACTIVE',
      otpPurpose: 'ADMIN_LOGIN',
      emailVerificationOtp: '123456',
    });
  });
});

describe('Admin activity history', () => {
  it('records application approval and rejection with the actor identity', async () => {
    const db = database();
    const service = new AdminApprovalsService(db, {} as any);
    await service.approveApplication('business', actor);
    await service.rejectApplication(
      'business',
      'Private document details',
      actor,
    );
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(
      db.adminActivity.create.mock.calls.map(([arg]: any) => arg.data.action),
    ).toEqual(['APPLICATION_APPROVED', 'APPLICATION_REJECTED']);
    expect(JSON.stringify(db.adminActivity.create.mock.calls)).not.toContain(
      'Private document details',
    );
    expect(db.adminActivity.create.mock.calls[0][0].data.actorName).toBe(
      'Review Admin',
    );
  });
  it('never records secret setting values', async () => {
    const db = database();
    await new AdminCmsService(db, {} as any).upsertSetting(
      'email',
      { fromName: 'SECRET' },
      actor,
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.adminActivity.create.mock.calls[0][0].data.action).toBe(
      'SETTING_CHANGED',
    );
    expect(JSON.stringify(db.adminActivity.create.mock.calls)).not.toContain(
      'SECRET',
    );
    await expect(
      new AdminCmsService(db, {} as any).upsertSetting(
        'email',
        { password: 'SECRET' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('propagates audit failure so the database transaction rolls back', async () => {
    const db = database();
    db.adminActivity.create.mockRejectedValue(new Error('audit unavailable'));
    await expect(
      new UsersService(db).updateStatus('u', 'SUSPENDED', actor),
    ).rejects.toThrow('audit unavailable');
  });
  it('is protected and returns bounded, deterministic pages', async () => {
    expect(Reflect.getMetadata('roles', AdminActivityController)).toEqual([
      'ADMIN',
      'SUPER_ADMIN',
    ]);
    expect(
      Reflect.getMetadata('__guards__', AdminActivityController),
    ).toHaveLength(2);
    const db = database();
    const result = await new AdminActivityController(db).list('2');
    expect(result).toMatchObject({ total: 26, page: 2, pageSize: 25 });
    expect(db.adminActivity.findMany).toHaveBeenCalledWith({
      skip: 25,
      take: 25,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    await expect(
      new AdminActivityController(db).list('-1'),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('Private chat sessions', () => {
  it('disconnects revoked room members before broadcasting messages', async () => {
    const stale = { data: { token: 'stale' }, disconnect: jest.fn() };
    const current = { data: { token: 'current' }, disconnect: jest.fn() };
    const emit = jest.fn();
    const gateway = new ChatGateway(
      {} as any,
      {
        verify: (token: string) => ({
          sub: 'u',
          type: 'access',
          sv: token === 'stale' ? 0 : 1,
        }),
      } as any,
      {
        findSessionById: async () => ({ status: 'ACTIVE', sessionVersion: 1 }),
      } as any,
    );
    gateway.server = {
      in: () => ({ fetchSockets: async () => [stale, current] }),
      to: () => ({ emit }),
    } as any;
    await gateway.broadcastMessage({ conversationId: 'room' });
    expect(stale.disconnect).toHaveBeenCalledWith(true);
    expect(current.disconnect).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(stale.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
      emit.mock.invocationCallOrder[0],
    );
  });
  it('does not broadcast when room authorization checks are unavailable', async () => {
    const emit = jest.fn();
    const gateway = new ChatGateway({} as any, {} as any, {} as any);
    gateway.server = {
      in: () => ({
        fetchSockets: async () => {
          throw new Error('offline');
        },
      }),
      to: () => ({ emit }),
    } as any;
    await expect(
      gateway.broadcastMessage({ conversationId: 'room' }),
    ).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('Account route HTTP security', () => {
  let app: INestApplication;
  const secret = 'isolated-http-test-secret';
  const jwt = new JwtService({ secret });
  const accounts: Record<string, any> = {};
  const users = {
    findSessionById: jest.fn(async (id: string) => accounts[id] || null),
    findById: jest.fn(async () => ({
      id: 'target',
      firstName: 'Safe',
      email: 'safe@example.com',
    })),
    findByEmail: jest.fn(async () => ({
      id: 'target',
      email: 'safe@example.com',
    })),
    logoutAllDevices: jest.fn(async (id: string) => {
      accounts[id].sessionVersion++;
      return { message: 'All sessions revoked' };
    }),
  };
  const previousSecret = process.env.JWT_SECRET;
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [UsersController],
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: users },
        { provide: EmailService, useValue: {} },
        { provide: STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    accounts.customer = {
      id: 'customer',
      status: 'ACTIVE',
      sessionVersion: 0,
      role: { name: 'CUSTOMER' },
    };
    accounts.admin = {
      id: 'admin',
      status: 'ACTIVE',
      sessionVersion: 0,
      role: { name: 'ADMIN' },
    };
  });
  afterAll(async () => {
    await app.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  function token(id = 'admin', type = 'access', version = 0) {
    return jwt.sign({ sub: id, type, sv: version, role: 'SUPER_ADMIN' });
  }
  it('denies unsigned and non-admin account lookups even with a privileged role claim', async () => {
    await request(app.getHttpServer()).get('/users/target').expect(401);
    await request(app.getHttpServer())
      .get('/users/target')
      .set('Authorization', `Bearer ${token('customer')}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/users/email/safe@example.com')
      .set('Authorization', `Bearer ${token('customer')}`)
      .expect(403);
    expect(users.findById).not.toHaveBeenCalled();
    expect(users.findByEmail).not.toHaveBeenCalled();
  });
  it('returns safe account details to an administrator', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/target')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);
    expect(response.body).toEqual({
      id: 'target',
      firstName: 'Safe',
      email: 'safe@example.com',
    });
  });
  it('rejects suspended accounts and refresh tokens at the HTTP guard', async () => {
    accounts.admin.status = 'SUSPENDED';
    await request(app.getHttpServer())
      .get('/users/target')
      .set('Authorization', `Bearer ${token()}`)
      .expect(401);
    accounts.admin.status = 'ACTIVE';
    await request(app.getHttpServer())
      .get('/users/target')
      .set('Authorization', `Bearer ${token('admin', 'refresh')}`)
      .expect(401);
  });
  it('invalidates existing access tokens immediately after logout-all', async () => {
    const bearer = `Bearer ${token()}`;
    await request(app.getHttpServer())
      .post('/users/me/logout-all')
      .set('Authorization', bearer)
      .expect(201);
    await request(app.getHttpServer())
      .get('/users/target')
      .set('Authorization', bearer)
      .expect(401);
    await request(app.getHttpServer())
      .get('/users/target')
      .set('Authorization', `Bearer ${token('admin', 'access', 1)}`)
      .expect(200);
  });
});
