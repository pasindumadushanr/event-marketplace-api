import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type UsageStatus = 'ok' | 'not_configured' | 'unavailable' | 'pending';
export type UsageLevel = 'normal' | 'warning' | 'critical' | 'unknown';
const number = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export function usageLevel(
  used: number | null,
  allowance: number | null,
): UsageLevel {
  if (used === null || allowance === null || allowance <= 0) return 'unknown';
  return used / allowance >= 0.95
    ? 'critical'
    : used / allowance >= 0.8
      ? 'warning'
      : 'normal';
}
export type MediaUsage = {
  checkedAt: string;
  cacheSeconds: number;
  uploadMode: string;
  cloudinary: {
    status: UsageStatus;
    message: string;
    level: UsageLevel;
    cloudName: string | null;
    plan: string | null;
    storageBytes: number | null;
    bandwidthBytes: number | null;
    transformations: number | null;
    creditsUsed: number | null;
    creditsAllowance: number | null;
    creditsRemaining: number | null;
    reportedAt: string | null;
  };
  r2: {
    status: UsageStatus;
    message: string;
    level: UsageLevel;
    bucket: string | null;
    storageBytes: number | null;
    objects: number | null;
    reportedAt: string | null;
    freeStorageReferenceBytes: number;
    bucketHeadroomBytes: number | null;
  };
};

@Injectable()
export class MediaUsageService {
  private cache?: { expires: number; value: MediaUsage };
  private pending?: Promise<MediaUsage>;

  async overview(): Promise<MediaUsage> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.value;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const [cloudinaryUsage, r2] = await Promise.all([
        this.cloudinaryUsage(),
        this.r2Usage(),
      ]);
      const value: MediaUsage = {
        checkedAt: new Date().toISOString(),
        cacheSeconds: 300,
        uploadMode: process.env.MEDIA_STORAGE_PROVIDER?.trim() || 'cloudinary',
        cloudinary: cloudinaryUsage,
        r2,
      };
      this.cache = { expires: Date.now() + 300000, value };
      return value;
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }

  private async cloudinaryUsage(): Promise<MediaUsage['cloudinary']> {
    const result: MediaUsage['cloudinary'] = {
      status: 'not_configured',
      message: 'Cloudinary monitoring is not connected.',
      level: 'unknown',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
      plan: null,
      storageBytes: null,
      bandwidthBytes: null,
      transformations: null,
      creditsUsed: null,
      creditsAllowance: null,
      creditsRemaining: null,
      reportedAt: null,
    };
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    )
      return result;
    try {
      const raw: unknown = await cloudinary.api.usage({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        timeout: 10000,
      });
      const data = record(raw);
      result.creditsUsed = number(record(data.credits).usage);
      result.creditsAllowance = number(record(data.credits).limit);
      result.storageBytes = number(record(data.storage).usage);
      result.bandwidthBytes = number(record(data.bandwidth).usage);
      result.transformations = number(record(data.transformations).usage);
      if (result.creditsUsed === null && result.storageBytes === null)
        throw new Error('Missing usage');
      result.status = 'ok';
      result.plan =
        typeof data.plan === 'string' ? data.plan.slice(0, 80) : null;
      result.reportedAt =
        typeof data.last_updated === 'string' &&
        Number.isFinite(Date.parse(data.last_updated))
          ? new Date(data.last_updated).toISOString()
          : null;
      result.creditsRemaining =
        result.creditsUsed !== null && result.creditsAllowance !== null
          ? Math.max(0, result.creditsAllowance - result.creditsUsed)
          : null;
      result.level = usageLevel(result.creditsUsed, result.creditsAllowance);
      result.message =
        result.level === 'critical'
          ? 'Credit allowance is nearly used or exceeded. Review the provider dashboard.'
          : result.level === 'warning'
            ? 'Credit usage is above 80%. Plan additional capacity.'
            : 'Storage, delivery and transformations share the reported credit allowance.';
      return result;
    } catch {
      return {
        ...result,
        status: 'unavailable',
        level: 'unknown',
        message:
          'Cannot read Cloudinary usage. Check the account credentials and provider availability.',
      };
    }
  }

  private async r2Usage(): Promise<MediaUsage['r2']> {
    const result: MediaUsage['r2'] = {
      status: 'not_configured',
      message:
        'R2 monitoring is not connected. A separate read-only Cloudflare analytics token is required.',
      level: 'unknown',
      bucket: process.env.R2_BUCKET_NAME || null,
      storageBytes: null,
      objects: null,
      reportedAt: null,
      freeStorageReferenceBytes: 10_000_000_000,
      bucketHeadroomBytes: null,
    };
    const account = process.env.R2_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_R2_ANALYTICS_TOKEN;
    if (!account || !/^[a-f0-9]{32}$/.test(account) || !result.bucket || !token)
      return result;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 2 * 86400000);
      const response = await fetch(
        'https://api.cloudflare.com/client/v4/graphql',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            query: `query MediaStorage($accountTag: string!, $startDate: Time!, $endDate: Time!, $bucketName: string!) {
            viewer { accounts(filter: {accountTag: $accountTag}) {
              r2StorageAdaptiveGroups(limit: 1, filter: {datetime_geq: $startDate, datetime_leq: $endDate, bucketName: $bucketName}, orderBy: [datetime_DESC]) {
                max { payloadSize metadataSize objectCount } dimensions { datetime }
              }
            } }
          }`,
            variables: {
              accountTag: account,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              bucketName: result.bucket,
            },
          }),
        },
      );
      if (!response.ok) throw new Error('Provider unavailable');
      const raw: unknown = await response.json();
      const data = record(raw);
      if (Array.isArray(data.errors) && data.errors.length)
        throw new Error('Analytics unavailable');
      const accounts = record(record(data.data).viewer).accounts;
      const groups = record(
        Array.isArray(accounts) ? accounts[0] : undefined,
      ).r2StorageAdaptiveGroups;
      if (!Array.isArray(groups)) throw new Error('Missing account');
      if (!groups.length)
        return {
          ...result,
          status: 'pending',
          message:
            'No recent R2 storage report yet. An empty report does not confirm zero usage.',
        };
      const row = record(groups[0]);
      const payload = number(record(row.max).payloadSize);
      const metadata = number(record(row.max).metadataSize);
      const timestamp = record(row.dimensions).datetime;
      if (
        payload === null ||
        metadata === null ||
        typeof timestamp !== 'string' ||
        !Number.isFinite(Date.parse(timestamp))
      )
        throw new Error('Invalid analytics');
      result.status = 'ok';
      result.storageBytes = payload + metadata;
      result.objects = number(record(row.max).objectCount);
      result.reportedAt = new Date(timestamp).toISOString();
      result.bucketHeadroomBytes = Math.max(
        0,
        result.freeStorageReferenceBytes - result.storageBytes,
      );
      result.level = usageLevel(
        result.storageBytes,
        result.freeStorageReferenceBytes,
      );
      result.message =
        'This bucket only. The 10 GB Standard free allowance is shared across the account; this is not remaining account capacity or a bill estimate.';
      return result;
    } catch {
      return {
        ...result,
        status: 'unavailable',
        message:
          'Cannot read R2 usage. Check analytics permissions, account/bucket details and provider availability.',
      };
    }
  }
}
