import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { StorageProvider } from './storage.provider';
import { r2ObjectKey, r2PublicOrigin } from './r2-config';

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private client?: S3Client;
  private bucket?: string;
  private origin?: string;

  // Remains dormant until R2 is selected; default Cloudinary installs need no R2 keys.
  configure() {
    if (this.client) return;
    const account = process.env.R2_ACCOUNT_ID?.trim();
    const bucket = process.env.R2_BUCKET_NAME?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    const origin = r2PublicOrigin();
    if (
      !account ||
      !/^[a-f0-9]{32}$/.test(account) ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey ||
      !origin
    )
      throw new Error(
        'Configure R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL before enabling R2',
      );
    this.bucket = bucket;
    this.origin = origin;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'general',
  ): Promise<string> {
    if (
      !/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/.test(folder) ||
      /(?:^|\/)documents?(?:\/|$)/.test(folder)
    )
      throw new BadRequestException('Choose a public media folder');
    const b = file?.buffer;
    if (!Buffer.isBuffer(b) || !b.length || b.length > 10 * 1024 * 1024)
      throw new BadRequestException('Choose media up to 10 MB');
    let extension: string | undefined;
    if (
      file.mimetype === 'image/jpeg' &&
      b.length >= 3 &&
      b[0] === 255 &&
      b[1] === 216 &&
      b[2] === 255
    )
      extension = 'jpg';
    if (
      file.mimetype === 'image/png' &&
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      extension = 'png';
    if (
      file.mimetype === 'image/webp' &&
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP'
    )
      extension = 'webp';
    if (
      file.mimetype === 'video/mp4' &&
      folder === 'gallery' &&
      b.length >= 12 &&
      b.toString('ascii', 4, 8) === 'ftyp'
    )
      extension = 'mp4';
    if (!extension)
      throw new BadRequestException(
        'Only JPEG, PNG, WebP and gallery MP4 media are supported',
      );
    this.configure();
    const key = `event_marketplace/${folder}/${randomUUID()}.${extension}`;
    try {
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: b,
          ContentLength: b.length,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
          ContentDisposition: 'inline',
        }),
      );
      return `${this.origin}/${key}`;
    } catch {
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable. Please try again.',
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const key = r2ObjectKey(fileUrl);
    if (!key) return;
    this.configure();
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
