// Controller method references are used as metadata keys, never invoked unbound.
/* eslint-disable @typescript-eslint/unbound-method */
import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from '../auth/auth.controller';
import { ContactController } from '../contact/contact.controller';
import { RecaptchaGuard } from './recaptcha.guard';

describe('reCAPTCHA protection', () => {
  const keys = [
    'NODE_ENV',
    'RECAPTCHA_SECRET_KEY',
    'RECAPTCHA_MIN_SCORE',
    'RECAPTCHA_ALLOWED_HOSTNAMES',
  ];
  const previous = keys.map((key) => process.env[key]);
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let guard: RecaptchaGuard;
  const context = (token: unknown = 'fresh-token') =>
    ({
      getHandler: () => AuthController.prototype.register,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-recaptcha-token': token } }),
      }),
    }) as unknown as ExecutionContext;
  const valid = () => ({
    success: true,
    action: 'register',
    hostname: 'nakathata.lk',
    score: 0.9,
    challenge_ts: new Date().toISOString(),
  });
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    delete process.env.RECAPTCHA_MIN_SCORE;
    delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
    fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(valid()) });
    global.fetch = fetchMock;
    guard = new RecaptchaGuard(new Reflector());
  });
  afterAll(() => {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
    global.fetch = originalFetch;
  });
  it('verifies with Google before allowing a request', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: URLSearchParams },
    ];
    expect(url).toBe('https://www.google.com/recaptcha/api/siteverify');
    expect(options.method).toBe('POST');
    expect(options.body.get('secret')).toBe('test-secret');
    expect(options.body.get('response')).toBe('fresh-token');
  });
  it.each(['', ['token'], 'x'.repeat(8193)])(
    'rejects malformed/missing tokens',
    async (token) => {
      await expect(guard.canActivate(context(token))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { action: 'contact' },
    { hostname: 'attacker.example' },
    { score: 0.1 },
    { score: '0.9' },
    { score: undefined },
    { score: 2 },
    { challenge_ts: 'invalid' },
    { challenge_ts: new Date(Date.now() - 180000).toISOString() },
    { challenge_ts: new Date(Date.now() + 60000).toISOString() },
  ])('rejects invalid verification response %j', async (override) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...valid(), ...override }),
    });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('accepts the explicitly allowed www host', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...valid(), hostname: 'www.nakathata.lk' }),
    });
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
  it('fails closed without production credentials', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('allows unconfigured local development without contacting Google', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.RECAPTCHA_SECRET_KEY;
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['not-a-number', '-1', '2'])(
    'fails closed for invalid score configuration %s',
    async (value) => {
      process.env.RECAPTCHA_MIN_SCORE = value;
      await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
  it('fails closed for Google outages/timeouts', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'));
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('fails closed for non-success HTTP responses', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('protects all intended controller handlers with distinct actions', () => {
    const reflector = new Reflector();
    for (const [handler, action] of [
      [AuthController.prototype.register, 'register'],
      [AuthController.prototype.forgotPassword, 'forgot_password'],
      [ContactController.prototype.submitContactForm, 'contact'],
    ] as const) {
      expect(reflector.get('recaptchaAction', handler)).toBe(action);
      expect(reflector.get('__guards__', handler)).toContain(RecaptchaGuard);
    }
  });
});
