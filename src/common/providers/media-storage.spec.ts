import { PassThrough } from 'node:stream';
import { Test } from '@nestjs/testing';
import { v2 as cloudinarySdk } from 'cloudinary';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  CloudinaryQuotaExceededException,
  CloudinaryStorageProvider,
  isCloudinaryQuotaError,
} from './cloudinary-storage.provider';
import { MediaStorageProvider } from './media-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';
import { MediaStorageModule } from './media-storage.module';
import { STORAGE_PROVIDER } from './storage.provider';
import { r2ObjectKey, r2PublicOrigin } from './r2-config';
import { invitationContent } from '../../invitations/invitation-content';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest
    .fn()
    .mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const savedEnv = { ...process.env };
const key =
  'event_marketplace/wedding-invitations/10000000-0000-4000-8000-000000000001.png';
const image = {
  buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  mimetype: 'image/png',
  originalname: '../../private.html',
  size: 8,
} as Express.Multer.File;
function r2Environment() {
  Object.assign(process.env, {
    R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_BUCKET_NAME: 'public-media',
    R2_ACCESS_KEY_ID: 'test-id',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_PUBLIC_URL: 'https://media.example.com',
  });
}
beforeEach(() => {
  process.env = { ...savedEnv };
  for (const k of [
    'MEDIA_STORAGE_PROVIDER',
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_URL',
  ])
    delete process.env[k];
  jest.clearAllMocks();
});
afterEach(() => {
  process.env = { ...savedEnv };
  jest.restoreAllMocks();
});

describe('Storage selection and failover', () => {
  function providers() {
    const cloudinary = {
      uploadFile: jest.fn().mockResolvedValue('cloudinary-url'),
      deleteFile: jest.fn(),
    };
    const r2 = {
      configure: jest.fn(),
      uploadFile: jest.fn().mockResolvedValue('r2-url'),
      deleteFile: jest.fn(),
    };
    return {
      cloudinary,
      r2,
      storage: new MediaStorageProvider(cloudinary as any, r2 as any),
    };
  }
  it('keeps Cloudinary as default with R2 dormant', async () => {
    const p = providers();
    expect(await p.storage.uploadFile(image, 'business')).toBe(
      'cloudinary-url',
    );
    expect(p.r2.configure).not.toHaveBeenCalled();
    expect(p.r2.uploadFile).not.toHaveBeenCalled();
  });
  it('sends new uploads directly to R2 when selected', async () => {
    process.env.MEDIA_STORAGE_PROVIDER = 'r2';
    const p = providers();
    expect(await p.storage.uploadFile(image, 'business')).toBe('r2-url');
    expect(p.cloudinary.uploadFile).not.toHaveBeenCalled();
    expect(p.r2.configure).toHaveBeenCalled();
  });
  it('falls back only after an explicit Cloudinary quota error', async () => {
    process.env.MEDIA_STORAGE_PROVIDER = 'cloudinary-r2-fallback';
    const p = providers();
    p.cloudinary.uploadFile.mockRejectedValue(
      new CloudinaryQuotaExceededException(),
    );
    expect(await p.storage.uploadFile(image, 'business')).toBe('r2-url');
    expect(p.r2.uploadFile).toHaveBeenCalledWith(image, 'business');
  });
  it.each(['cloudinary', 'cloudinary-r2-fallback'])(
    'does not hide unrelated errors in %s mode',
    async (mode) => {
      process.env.MEDIA_STORAGE_PROVIDER = mode;
      const p = providers();
      const error = new Error('Authentication or upload validation failed');
      p.cloudinary.uploadFile.mockRejectedValue(error);
      await expect(p.storage.uploadFile(image)).rejects.toBe(error);
      expect(p.r2.uploadFile).not.toHaveBeenCalled();
    },
  );
  it('does not claim success if fallback also fails', async () => {
    process.env.MEDIA_STORAGE_PROVIDER = 'cloudinary-r2-fallback';
    const p = providers();
    p.cloudinary.uploadFile.mockRejectedValue(
      new CloudinaryQuotaExceededException(),
    );
    p.r2.uploadFile.mockRejectedValue(new Error('R2 unavailable'));
    await expect(p.storage.uploadFile(image)).rejects.toThrow('R2 unavailable');
  });
  it('routes deletes by saved URL even after switching providers', async () => {
    r2Environment();
    process.env.MEDIA_STORAGE_PROVIDER = 'r2';
    const p = providers();
    await p.storage.deleteFile(
      'https://res.cloudinary.com/old-cloud/image/upload/v1/example.jpg',
    );
    expect(p.cloudinary.deleteFile).toHaveBeenCalled();
    expect(p.r2.deleteFile).not.toHaveBeenCalled();
    process.env.MEDIA_STORAGE_PROVIDER = 'cloudinary';
    const other = providers();
    await other.storage.deleteFile('https://media.example.com/' + key);
    expect(other.r2.deleteFile).toHaveBeenCalled();
    expect(other.cloudinary.deleteFile).not.toHaveBeenCalled();
  });
  it('rejects an unknown mode and fails startup when selected R2 is incomplete', () => {
    process.env.MEDIA_STORAGE_PROVIDER = 'unknown';
    expect(() => providers()).toThrow('MEDIA_STORAGE_PROVIDER');
    process.env.MEDIA_STORAGE_PROVIDER = 'r2';
    expect(
      () => new MediaStorageProvider({} as any, new R2StorageProvider()),
    ).toThrow('Configure R2');
  });
  it('exports the shared storage token through Nest', async () => {
    const module = await Test.createTestingModule({
      imports: [MediaStorageModule],
    }).compile();
    expect(module.get(STORAGE_PROVIDER)).toBeInstanceOf(MediaStorageProvider);
    await module.close();
  });
});

describe('Quota classification at the Cloudinary boundary', () => {
  it.each([
    'Storage quota exceeded',
    'Account has exceeded its usage limits',
    'Credit limit reached',
    'Bandwidth limit exceeded',
  ])('recognizes %s', (message) => {
    expect(isCloudinaryQuotaError({ http_code: 420, message })).toBe(true);
  });
  it.each([
    { http_code: 401, message: 'Invalid API key' },
    { http_code: 429, message: 'Too many requests' },
    { http_code: 500, message: 'Network timeout' },
    { http_code: 400, message: 'Unsupported image format' },
  ])('does not classify %j as quota', (error) => {
    expect(isCloudinaryQuotaError(error)).toBe(false);
  });
  it('preserves a quota classification through an actual Cloudinary upload callback', async () => {
    jest.spyOn(cloudinarySdk.uploader, 'upload_stream').mockImplementation(((
      options,
      callback,
    ) => {
      const stream = new PassThrough();
      stream.on('finish', () =>
        callback(
          { http_code: 420, message: 'Storage quota exceeded' },
          undefined,
        ),
      );
      return stream;
    }) as any);
    await expect(
      new CloudinaryStorageProvider().uploadFile(image),
    ).rejects.toBeInstanceOf(CloudinaryQuotaExceededException);
  });
  it('will not delete objects from spoofed hosts or a different Cloudinary account', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'our-cloud';
    const destroy = jest
      .spyOn(cloudinarySdk.uploader, 'destroy')
      .mockResolvedValue({ result: 'ok' });
    const storage = new CloudinaryStorageProvider();
    await storage.deleteFile(
      'https://evil.example/res.cloudinary.com/our-cloud/image/upload/v1/test.jpg',
    );
    await storage.deleteFile(
      'https://res.cloudinary.com/another-cloud/image/upload/v1/test.jpg',
    );
    expect(destroy).not.toHaveBeenCalled();
    await storage.deleteFile(
      'https://res.cloudinary.com/our-cloud/image/upload/v1/event_marketplace/business/test.jpg',
    );
    expect(destroy).toHaveBeenCalledWith('event_marketplace/business/test', {
      resource_type: 'image',
    });
  });
});

describe('R2 object writes and URL boundaries', () => {
  it('writes safe random keys, matching MIME and cache headers through the S3 endpoint', async () => {
    r2Environment();
    const storage = new R2StorageProvider();
    const url = await storage.uploadFile(image, 'business');
    expect(url).toMatch(
      /^https:\/\/media.example.com\/event_marketplace\/business\/[0-9a-f-]{36}\.png$/,
    );
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com',
        region: 'auto',
      }),
    );
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'public-media',
        Body: image.buffer,
        ContentType: 'image/png',
        ContentLength: 8,
        ContentDisposition: 'inline',
      }),
    );
  });
  it.each([
    [{ ...image, mimetype: 'image/svg+xml' }, 'business'],
    [{ ...image, buffer: Buffer.from('<html>') }, 'business'],
    [{ ...image, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }, 'business'],
    [image, '../documents'],
    [image, 'documents'],
  ])(
    'rejects unsafe media/folders before contacting R2',
    async (file, folder) => {
      r2Environment();
      await expect(
        new R2StorageProvider().uploadFile(file as any, folder as string),
      ).rejects.toThrow();
      expect(S3Client).not.toHaveBeenCalled();
    },
  );
  it('deletes only generated keys from the exact configured media origin', async () => {
    r2Environment();
    const storage = new R2StorageProvider();
    for (const url of [
      'https://media.example.com.evil.com/' + key,
      'https://media.example.com/other/private.txt',
      'https://media.example.com/' + key + '?download=1',
    ])
      await storage.deleteFile(url);
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
    await storage.deleteFile('https://media.example.com/' + key);
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'public-media',
      Key: key,
    });
  });
  it.each([
    'http://media.example.com',
    'https://user:secret@media.example.com',
    'https://media.example.com/path',
    'https://media.example.com/?x=1',
  ])('rejects invalid domain configuration %s', (value) => {
    expect(() => r2PublicOrigin(value)).toThrow();
  });
  it('requires a custom domain for production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => r2PublicOrigin('https://pub-example.r2.dev')).toThrow();
  });
  it('accepts R2 invitation images without accepting arbitrary domains or other folders', () => {
    r2Environment();
    const url = 'https://media.example.com/' + key;
    expect(invitationContent({ couplePhoto: url }).couplePhoto).toBe(url);
    expect(() =>
      invitationContent({
        couplePhoto: url.replace('wedding-invitations', 'business'),
      }),
    ).toThrow();
    expect(() =>
      invitationContent({
        couplePhoto: url.replace(
          'media.example.com',
          'media.example.com.evil.com',
        ),
      }),
    ).toThrow();
    expect(r2ObjectKey(url + '#fragment')).toBeUndefined();
  });
});
