import { AuthService } from './auth.service';
import { GoogleLoginGuard } from './guards/google-login.guard';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

const profile = {
  googleId: 'google-123',
  email: 'vendor@gmail.com',
  emailVerified: true,
  firstName: 'Test',
};
function setup(account: any = null) {
  const users: any = {
    findAuthByGoogleId: jest.fn().mockResolvedValue(null),
    findAuthByEmail: jest.fn().mockResolvedValue(account),
    findAuthById: jest
      .fn()
      .mockResolvedValue(
        account || { id: 'new', status: 'ACTIVE', role: { name: 'VENDOR' } },
      ),
    create: jest.fn().mockResolvedValue({ id: 'new' }),
    updateUser: jest.fn().mockResolvedValue({ id: account?.id || 'existing' }),
  };
  const roles: any = {
    findByName: jest.fn().mockResolvedValue({ id: 'role' }),
  };
  return {
    users,
    roles,
    service: new AuthService(users, {} as any, roles, {} as any),
  };
}
describe('Google vendor identities', () => {
  it('creates vendors only for vendor intent, without creating or approving a business', async () => {
    const { service, roles, users } = setup();
    await service.validateOAuthLogin(profile, 'vendor');
    expect(roles.findByName).toHaveBeenCalledWith('VENDOR');
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: true,
        role: { connect: { id: 'role' } },
      }),
    );
    expect(users.create.mock.calls[0][0]).not.toHaveProperty('business');
  });
  it('keeps ordinary Google registration as CUSTOMER', async () => {
    const { service, roles } = setup();
    await service.validateOAuthLogin(profile);
    expect(roles.findByName).toHaveBeenCalledWith('CUSTOMER');
  });
  it('preserves password sign-in and reloads the vendor role after linking', async () => {
    const account = {
      id: 'v',
      status: 'ACTIVE',
      password: 'hash',
      authProvider: 'local',
      role: { name: 'VENDOR' },
    };
    const { service, users } = setup(account);
    await expect(
      service.validateOAuthLogin(profile, 'vendor'),
    ).resolves.toEqual(account);
    expect(users.updateUser).toHaveBeenCalledWith('v', {
      googleId: profile.googleId,
      emailVerified: true,
    });
    expect(users.create).not.toHaveBeenCalled();
  });
  it.each(['CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'INVITATION_STAFF'])(
    'does not convert or admit %s through vendor Google login',
    async (role) => {
      const { service, users } = setup({
        id: 'x',
        status: 'ACTIVE',
        role: { name: role },
      });
      await expect(
        service.validateOAuthLogin(profile, 'vendor'),
      ).rejects.toThrow();
      expect(users.updateUser).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    },
  );
  it('rejects suspended accounts and conflicting linked Google identities', async () => {
    for (const account of [
      { status: 'SUSPENDED' },
      { status: 'ACTIVE', googleId: 'another-google' },
    ]) {
      const { service } = setup({
        ...account,
        id: 'v',
        role: { name: 'VENDOR' },
      });
      await expect(
        service.validateOAuthLogin(profile, 'vendor'),
      ).rejects.toThrow();
    }
  });
  it('uses the stable Google identifier before email matching', async () => {
    const { service, users } = setup();
    const account = {
      id: 'v',
      status: 'ACTIVE',
      googleId: profile.googleId,
      emailVerified: true,
      role: { name: 'VENDOR' },
    };
    users.findAuthByGoogleId.mockResolvedValue(account);
    users.findAuthById.mockResolvedValue(account);
    await service.validateOAuthLogin(profile, 'vendor');
    expect(users.findAuthByEmail).not.toHaveBeenCalled();
    expect(users.updateUser).not.toHaveBeenCalled();
  });
  it('requires verified Google email and does not auto-link third-party email addresses', async () => {
    const { service, users } = setup({
      id: 'v',
      status: 'ACTIVE',
      role: { name: 'VENDOR' },
    });
    await expect(
      service.validateOAuthLogin(
        { ...profile, emailVerified: false },
        'vendor',
      ),
    ).rejects.toThrow();
    await expect(
      service.validateOAuthLogin(
        { ...profile, email: 'vendor@example.com' },
        'vendor',
      ),
    ).rejects.toThrow();
    expect(users.updateUser).not.toHaveBeenCalled();
  });
  it('requires platform email verification for new third-party-email Google accounts', async () => {
    const { service, users } = setup();
    await service.validateOAuthLogin(
      { ...profile, email: 'vendor@example.com' },
      'vendor',
    );
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false }),
    );
  });
});

describe('Google login state binding', () => {
  const jwt = new JwtService({ secret: 'isolated-test-secret' });
  function context(req: any) {
    const res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
    return {
      res,
      ctx: {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      } as any,
    };
  }
  beforeEach(() =>
    jest
      .spyOn(AuthGuard('google').prototype, 'canActivate')
      .mockResolvedValue(true),
  );
  afterEach(() => jest.restoreAllMocks());
  it('binds a signed vendor intent to an HttpOnly browser cookie and accepts the matching callback', async () => {
    const guard = new GoogleLoginGuard(jwt);
    const req: any = {
      path: '/auth/google',
      query: { intent: 'vendor' },
      headers: {},
    };
    const { ctx, res } = context(req);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verify(req.googleState)).toMatchObject({
      type: 'google-login-state',
      intent: 'vendor',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'nakathata_google_state',
      req.googleState,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    const callback: any = {
      path: '/auth/google/callback',
      query: { state: req.googleState },
      headers: { cookie: `nakathata_google_state=${req.googleState}` },
    };
    await expect(guard.canActivate(context(callback).ctx)).resolves.toBe(true);
    expect(callback.googleIntent).toBe('vendor');
  });
  it('rejects missing, mismatched, expired, and wrong-purpose state before passport runs', async () => {
    const guard = new GoogleLoginGuard(jwt);
    const expired = jwt.sign(
      { type: 'google-login-state', intent: 'vendor' },
      { expiresIn: -1 },
    );
    const wrong = jwt.sign({ type: 'access', intent: 'vendor' });
    for (const [state, cookie] of [
      ['', ''],
      ['abc', 'def'],
      [expired, expired],
      [wrong, wrong],
    ]) {
      const { ctx, res } = context({
        path: '/auth/google/callback',
        query: { state },
        headers: { cookie: `nakathata_google_state=${cookie}` },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      expect(res.redirect).toHaveBeenCalled();
    }
    expect(AuthGuard('google').prototype.canActivate).not.toHaveBeenCalled();
  });
});
