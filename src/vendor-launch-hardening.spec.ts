import { VendorContentBuilderService } from './vendor-content-builder/vendor-content-builder.service';
import { VendorDocumentsService } from './vendor-documents/vendor-documents.service';
import { UsersService } from './users/users.service';
import { AuthService } from './auth/auth.service';
import { NotificationsService } from './notifications/notifications.service';
import { VendorApprovedGuard } from './auth/guards/vendor-approved.guard';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

describe('Vendor launch security boundaries', () => {
  it.each(['businessId', 'business', 'id', 'createdAt', 'content'])(
    'refuses section mutation through %s on both create and update',
    async (field) => {
      const db: any = {
        business: { findFirst: jest.fn() },
        businessContentSection: { create: jest.fn(), update: jest.fn() },
      };
      const service = new VendorContentBuilderService(db);
      await expect(
        service.createBlock('owner', { [field]: 'foreign' }),
      ).rejects.toThrow('Only section content');
      await expect(
        service.updateBlock('owner', 'block', { [field]: 'foreign' }),
      ).rejects.toThrow('Only section content');
      expect(db.businessContentSection.create).not.toHaveBeenCalled();
      expect(db.businessContentSection.update).not.toHaveBeenCalled();
    },
  );
  it('allows editing content only after matching block ownership', async () => {
    const db: any = {
      business: {
        findFirst: jest.fn().mockResolvedValue({ id: 'own-business' }),
      },
      businessContentSection: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new VendorContentBuilderService(db);
    await expect(
      service.updateBlock('owner', 'other-block', { title: 'Example' }),
    ).rejects.toThrow('does not belong');
    expect(db.businessContentSection.update).not.toHaveBeenCalled();
    db.businessContentSection.findFirst.mockResolvedValue({ id: 'own-block' });
    await service.updateBlock('owner', 'own-block', {
      title: 'Example',
      status: 'DRAFT',
    });
    expect(db.businessContentSection.update).toHaveBeenCalledWith({
      where: { id: 'own-block' },
      data: { title: 'Example', status: 'DRAFT' },
    });
  });
  it('does not upload sensitive documents while private delivery is unavailable', async () => {
    const storage = { uploadFile: jest.fn(), deleteFile: jest.fn() };
    const db: any = { document: { create: jest.fn() } };
    await expect(
      new VendorDocumentsService(db, storage).uploadDocument(
        'owner',
        'ID',
        {} as any,
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.document.create).not.toHaveBeenCalled();
  });
  it('limits broadcast queries to records without a recipient', async () => {
    const db: any = { notification: { findMany: jest.fn() } };
    await new NotificationsService(db).getUserNotifications('owner', 'VENDOR');
    expect(db.notification.findMany.mock.calls[0][0].where.OR).toEqual([
      { userId: 'owner' },
      { userId: null, targetRole: 'VENDOR' },
      { userId: null, targetRole: 'ALL' },
    ]);
  });
  it('does not disclose an outsider notification or mutate a shared read flag', async () => {
    const db: any = {
      notification: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ userId: 'someone-else', message: 'private' }),
        update: jest.fn(),
      },
    };
    await expect(
      new NotificationsService(db).markAsRead('notice', 'owner'),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.notification.update).not.toHaveBeenCalled();
  });
  it('does not assign a public audience to a direct notification', async () => {
    const db: any = { notification: { create: jest.fn() } };
    await new NotificationsService(db).createBroadcast({
      title: 'Private',
      message: 'Update',
      userId: 'owner',
    });
    expect(db.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'owner',
      targetRole: null,
    });
  });
});

describe('Account email changes', () => {
  let db: any;
  beforeEach(async () => {
    db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'old@example.test',
          password: await bcrypt.hash('current-password', 4),
          authProvider: 'local',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          email: 'new@example.test',
          emailVerified: false,
        }),
      },
      business: { updateMany: jest.fn() },
    };
    db.$transaction = jest.fn((callback: any) => callback(db));
  });
  it.each([undefined, 'wrong-password'])(
    'rejects email changes without password proof: %s',
    async (currentPassword) => {
      await expect(
        new UsersService(db).updateMe('owner', {
          email: 'new@example.test',
          currentPassword,
        }),
      ).rejects.toThrow('current password');
      expect(db.user.update).not.toHaveBeenCalled();
    },
  );
  it('revokes verification and sessions and unpublishes profiles atomically', async () => {
    await new UsersService(db).updateMe('owner', {
      email: 'New@Example.Test',
      currentPassword: 'current-password',
    });
    expect(db.$transaction).toHaveBeenCalled();
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      email: 'new@example.test',
      emailVerified: false,
      sessionVersion: { increment: 1 },
      hashedRefreshToken: null,
      emailVerificationOtp: null,
    });
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty(
      'currentPassword',
    );
    expect(db.business.updateMany).toHaveBeenCalledWith({
      where: { vendorId: 'owner', status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });
  });
  it('preserves verification when saving an unchanged email', async () => {
    await new UsersService(db).updateMe('owner', {
      email: 'old@example.test',
      firstName: 'Updated',
    });
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty(
      'emailVerified',
    );
    expect(db.business.updateMany).not.toHaveBeenCalled();
  });
  it('refuses changing a Google-managed email even with a local password', async () => {
    db.user.findUnique.mockResolvedValue({
      email: 'old@example.test',
      authProvider: 'google',
    });
    await expect(
      new UsersService(db).updateMe('owner', {
        email: 'new@example.test',
        currentPassword: 'current-password',
      }),
    ).rejects.toThrow('managed by Google');
  });
});

describe('Verification email delivery', () => {
  it('clears an undelivered code and reports a retryable failure', async () => {
    const users: any = {
      findAuthById: jest.fn().mockResolvedValue({
        email: 'example@example.test',
        emailVerified: false,
      }),
      updateUser: jest.fn(),
    };
    const service = new AuthService(
      users,
      {} as any,
      {} as any,
      { sendOtpEmail: jest.fn().mockResolvedValue(false) } as any,
    );
    await expect(service.sendVerificationOtp('owner')).rejects.toMatchObject({
      status: 503,
    });
    expect(users.updateUser).toHaveBeenLastCalledWith('owner', {
      otpPurpose: null,
      emailVerificationOtp: null,
      emailVerificationOtpExpiry: null,
    });
  });
  it('does not replace or resend a recently issued code', async () => {
    const users: any = {
      findAuthById: jest.fn().mockResolvedValue({
        emailVerified: false,
        otpPurpose: 'EMAIL_VERIFY',
        emailVerificationOtpExpiry: new Date(Date.now() + 15 * 60000),
      }),
      updateUser: jest.fn(),
    };
    const email: any = { sendOtpEmail: jest.fn() };
    await expect(
      new AuthService(users, {} as any, {} as any, email).sendVerificationOtp(
        'owner',
      ),
    ).rejects.toThrow('wait one minute');
    expect(email.sendOtpEmail).not.toHaveBeenCalled();
  });
});

describe('Approved vendor API guard', () => {
  const context = (user: any) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;
  it('uses the real session shape and owning vendor ID', async () => {
    const db: any = {
      business: {
        findFirst: jest.fn().mockResolvedValue({ vendorStatus: 'APPROVED' }),
      },
    };
    await expect(
      new VendorApprovedGuard(db).canActivate(
        context({
          id: 'owner',
          role: { name: 'VENDOR' },
          status: 'ACTIVE',
          emailVerified: true,
        }),
      ),
    ).resolves.toBe(true);
    expect(db.business.findFirst.mock.calls[0][0].where).toEqual({
      vendorId: 'owner',
    });
  });
  it.each(['UNDER_REVIEW', 'NEEDS_INFO', 'REJECTED', 'SUSPENDED'])(
    'blocks %s vendors from approved tools',
    async (vendorStatus) => {
      const db: any = {
        business: { findFirst: jest.fn().mockResolvedValue({ vendorStatus }) },
      };
      await expect(
        new VendorApprovedGuard(db).canActivate(
          context({
            id: 'owner',
            role: { name: 'VENDOR' },
            status: 'ACTIVE',
            emailVerified: true,
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
});

describe('Refresh session rotation', () => {
  const jwt = new JwtService({ secret: 'local-test-session-secret' });
  let user: any;
  let users: any;
  let service: AuthService;
  beforeEach(() => {
    user = {
      id: 'owner',
      email: 'owner@example.test',
      firstName: 'Test',
      lastName: 'Owner',
      status: 'ACTIVE',
      sessionVersion: 2,
      role: { name: 'VENDOR' },
      hashedRefreshToken: null,
    };
    users = {
      findSessionById: jest.fn(async () => user),
      findAuthById: jest.fn(async () => user),
      updateRefreshToken: jest.fn(async (_id, hash) => {
        user.hashedRefreshToken = hash;
      }),
      consumeRefreshToken: jest.fn(async (_id, hash, version) => {
        if (user.hashedRefreshToken !== hash || user.sessionVersion !== version)
          throw new Error('Session changed');
        user.hashedRefreshToken = null;
      }),
    };
    service = new AuthService(users, jwt, {} as any, {} as any);
  });
  it('renews once and rejects replay of the consumed token', async () => {
    const first = await service.generateTokens(
      'owner',
      user.email,
      'VENDOR',
      'Test',
      'Owner',
    );
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const payload = jwt.verify(second.accessToken);
    expect(payload.exp - payload.iat).toBe(3600);
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
    expect(
      await bcrypt.compare(
        createHash('sha256').update(second.refreshToken).digest('hex'),
        user.hashedRefreshToken,
      ),
    ).toBe(true);
  });
  it('rejects access tokens, tampered tokens and revoked versions', async () => {
    const first = await service.generateTokens(
      'owner',
      user.email,
      'VENDOR',
      'Test',
      'Owner',
    );
    await expect(service.refresh(first.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      service.refresh(first.refreshToken + 'x'),
    ).rejects.toMatchObject({ status: 401 });
    user.sessionVersion++;
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('does not mint a new session if revocation races with refresh', async () => {
    const first = await service.generateTokens(
      'owner',
      user.email,
      'VENDOR',
      'Test',
      'Owner',
    );
    users.consumeRefreshToken.mockImplementation(async () => {
      user.sessionVersion++;
    });
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('does not accept a different JWT with the same long prefix', async () => {
    const first = await service.generateTokens(
      'owner',
      user.email,
      'VENDOR',
      'Test',
      'Owner',
    );
    const forgedRotation = jwt.sign({
      ...jwt.verify(first.refreshToken),
      jti: 'different-token',
    });
    await expect(service.refresh(forgedRotation)).rejects.toMatchObject({
      status: 401,
    });
  });
});
