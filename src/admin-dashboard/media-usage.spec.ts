import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { v2 as cloudinary } from 'cloudinary';
import { MediaUsageService, usageLevel } from './media-usage.service';
import { MediaUsageController } from './media-usage.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const savedEnv = { ...process.env };
function cloudConfig() {
  Object.assign(process.env, {
    CLOUDINARY_CLOUD_NAME: 'our-cloud',
    CLOUDINARY_API_KEY: 'private-key',
    CLOUDINARY_API_SECRET: 'private-secret',
  });
}
function r2Config() {
  Object.assign(process.env, {
    R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_BUCKET_NAME: 'public-media',
    CLOUDFLARE_R2_ANALYTICS_TOKEN: 'private-analytics-token',
  });
}
const cloudReport = {
  plan: 'Free',
  credits: { usage: 20, limit: 25 },
  storage: { usage: 200000000 },
  bandwidth: { usage: 800000000 },
  transformations: { usage: 12 },
  last_updated: '2026-11-01T06:00:00Z',
};
function r2Response(
  groups: unknown[] = [
    {
      max: { payloadSize: 8e9, metadataSize: 1000, objectCount: 17 },
      dimensions: { datetime: '2026-11-01T06:00:00Z' },
    },
  ],
) {
  return {
    ok: true,
    json: async () => ({
      data: { viewer: { accounts: [{ r2StorageAdaptiveGroups: groups }] } },
    }),
  } as Response;
}
beforeEach(() => {
  process.env = { ...savedEnv };
  for (const k of [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'CLOUDFLARE_R2_ANALYTICS_TOKEN',
  ])
    delete process.env[k];
});
afterEach(() => {
  process.env = { ...savedEnv };
  jest.restoreAllMocks();
});
describe('Media usage reports', () => {
  it('reports missing integrations honestly without contacting providers', async () => {
    const cloud = jest.spyOn(cloudinary.api, 'usage');
    const fetch = jest.spyOn(global, 'fetch');
    const report = await new MediaUsageService().overview();
    expect(report.cloudinary).toMatchObject({
      status: 'not_configured',
      storageBytes: null,
      creditsRemaining: null,
    });
    expect(report.r2).toMatchObject({
      status: 'not_configured',
      storageBytes: null,
      bucketHeadroomBytes: null,
    });
    expect(cloud).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses real reported credits without describing them as free storage', async () => {
    cloudConfig();
    jest.spyOn(cloudinary.api, 'usage').mockResolvedValue(cloudReport as any);
    const report = await new MediaUsageService().overview();
    expect(report.cloudinary).toMatchObject({
      status: 'ok',
      creditsRemaining: 5,
      creditsUsed: 20,
      storageBytes: 200000000,
      level: 'warning',
    });
    expect(JSON.stringify(report)).not.toMatch(/private-key|private-secret/);
  });
  it('does not invent an allowance when the provider omits it', async () => {
    cloudConfig();
    jest
      .spyOn(cloudinary.api, 'usage')
      .mockResolvedValue({ ...cloudReport, credits: { usage: 1 } } as any);
    expect((await new MediaUsageService().overview()).cloudinary).toMatchObject(
      {
        status: 'ok',
        creditsAllowance: null,
        creditsRemaining: null,
        level: 'unknown',
      },
    );
  });
  it('redacts provider errors and does not mark a failed account healthy', async () => {
    cloudConfig();
    jest
      .spyOn(cloudinary.api, 'usage')
      .mockRejectedValue(new Error('private-secret cloud_name mismatch'));
    const report = await new MediaUsageService().overview();
    expect(report.cloudinary).toMatchObject({
      status: 'unavailable',
      level: 'unknown',
      storageBytes: null,
    });
    expect(JSON.stringify(report)).not.toContain('private-secret');
  });
  it('rejects malformed negative usage instead of presenting it as spare capacity', async () => {
    cloudConfig();
    jest
      .spyOn(cloudinary.api, 'usage')
      .mockResolvedValue({
        credits: { usage: -5, limit: 25 },
        storage: { usage: -1 },
      } as any);
    expect((await new MediaUsageService().overview()).cloudinary.status).toBe(
      'unavailable',
    );
  });
  it('shares concurrent requests and caches reports to avoid provider rate limits', async () => {
    cloudConfig();
    const usage = jest
      .spyOn(cloudinary.api, 'usage')
      .mockResolvedValue(cloudReport as any);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const service = new MediaUsageService();
    const [a, b] = await Promise.all([service.overview(), service.overview()]);
    expect(a).toBe(b);
    await service.overview();
    expect(usage).toHaveBeenCalledTimes(1);
    jest.spyOn(Date, 'now').mockReturnValue(now + 300001);
    await service.overview();
    expect(usage).toHaveBeenCalledTimes(2);
  });
  it('reads R2 bucket analytics with a fixed endpoint, read-only token and exact bucket filter', async () => {
    r2Config();
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(r2Response());
    const report = await new MediaUsageService().overview();
    expect(report.r2).toMatchObject({
      status: 'ok',
      storageBytes: 8e9 + 1000,
      objects: 17,
      level: 'warning',
      bucketHeadroomBytes: 2e9 - 1000,
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(JSON.parse(options!.body as string).variables.bucketName).toBe(
      'public-media',
    );
    expect(report.r2.message).toContain('not remaining account capacity');
    expect(JSON.stringify(report)).not.toContain('private-analytics-token');
  });
  it('treats an empty R2 report as pending, not an empty bucket', async () => {
    r2Config();
    jest.spyOn(global, 'fetch').mockResolvedValue(r2Response([]));
    expect((await new MediaUsageService().overview()).r2).toMatchObject({
      status: 'pending',
      storageBytes: null,
      bucketHeadroomBytes: null,
    });
  });
  it('accepts a provider-confirmed zero-byte report', async () => {
    r2Config();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        r2Response([
          {
            max: { payloadSize: 0, metadataSize: 0, objectCount: 0 },
            dimensions: { datetime: '2026-11-01T06:00:00Z' },
          },
        ]),
      );
    expect((await new MediaUsageService().overview()).r2).toMatchObject({
      status: 'ok',
      storageBytes: 0,
      objects: 0,
    });
  });
  it('handles HTTP-200 GraphQL errors without leaking tokens or reporting zero', async () => {
    r2Config();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          errors: [{ message: 'private-analytics-token rejected' }],
        }),
      } as Response);
    const report = await new MediaUsageService().overview();
    expect(report.r2).toMatchObject({
      status: 'unavailable',
      storageBytes: null,
    });
    expect(JSON.stringify(report)).not.toContain('private-analytics-token');
  });
  it('keeps the other provider usable when R2 fails', async () => {
    cloudConfig();
    r2Config();
    jest.spyOn(cloudinary.api, 'usage').mockResolvedValue(cloudReport as any);
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('private-analytics-token timeout'));
    const report = await new MediaUsageService().overview();
    expect(report.cloudinary.status).toBe('ok');
    expect(report.r2.status).toBe('unavailable');
  });
  it.each([
    [79, 100, 'normal'],
    [80, 100, 'warning'],
    [95, 100, 'critical'],
    [110, 100, 'critical'],
    [null, 100, 'unknown'],
    [1, null, 'unknown'],
    [1, 0, 'unknown'],
  ])('classifies planning threshold %s/%s', (used, limit, level) => {
    expect(usageLevel(used as number | null, limit as number | null)).toBe(
      level,
    );
  });
});

describe('Media usage HTTP role boundaries', () => {
  let app: INestApplication;
  let base: string;
  const overview = jest.fn(async () => ({ checkedAt: 'test-report' }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaUsageController],
      providers: [{ provide: MediaUsageService, useValue: { overview } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) return false;
          req.user = { role: { name: role } };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  it.each(['VENDOR', 'CUSTOMER', 'INVITATION_STAFF'])(
    'rejects %s before querying provider usage',
    async (role) => {
      const before = overview.mock.calls.length;
      const response = await fetch(base + '/admin/media-usage', {
        headers: { 'x-test-role': role },
      });
      expect(response.status).toBe(403);
      expect(overview.mock.calls.length).toBe(before);
    },
  );
  it.each(['ADMIN', 'SUPER_ADMIN'])(
    'allows %s and prevents browser caching',
    async (role) => {
      const response = await fetch(base + '/admin/media-usage', {
        headers: { 'x-test-role': role },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    },
  );
  it('rejects missing authentication', async () => {
    const response = await fetch(base + '/admin/media-usage');
    expect(response.status).toBe(403);
  });
});
