import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageProvider } from './storage.provider';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

export class CloudinaryQuotaExceededException extends ServiceUnavailableException {
  constructor() {
    super('Cloudinary media quota exceeded');
  }
}

export function isCloudinaryQuotaError(error: {
  http_code?: number;
  message?: string;
}): boolean {
  // Authentication, malformed uploads and transient network failures must not silently fail over.
  if (Number(error.http_code) === 401) return false;
  const message = error.message || '';
  return (
    /quota|credits?|storage|bandwidth|usage limits?|plan limits?/i.test(
      message,
    ) && /exceed|exhaust|limit|reached/i.test(message)
  );
}

@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `event_marketplace/${folder}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            if (isCloudinaryQuotaError(error))
              return reject(new CloudinaryQuotaExceededException());
            this.logger.error('Cloudinary Upload Error', error);
            return reject(
              new InternalServerErrorException(
                `Failed to upload file to Cloudinary: ${error.message || JSON.stringify(error)}`,
              ),
            );
          }
          if (result && result.secure_url) {
            resolve(result.secure_url);
          } else {
            reject(
              new InternalServerErrorException(
                'Failed to get secure URL from Cloudinary',
              ),
            );
          }
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const url = new URL(fileUrl);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        url.username ||
        url.password
      )
        return;
      if (url.pathname.split('/')[1] !== process.env.CLOUDINARY_CLOUD_NAME)
        return;

      // Extract public ID from URL
      // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567/folder/file_name.jpg
      const parts = fileUrl.split('/');
      const lastPart = parts.pop();
      if (!lastPart) return;

      const fileNameWithoutExt = lastPart.split('.')[0];
      const folderPath = parts.slice(parts.indexOf('upload') + 2).join('/'); // Skip 'upload' and version
      const publicId = folderPath
        ? `${folderPath}/${fileNameWithoutExt}`
        : fileNameWithoutExt;

      // Determine resource type based on URL (video or image)
      const resourceType = fileUrl.includes('/video/upload/')
        ? 'video'
        : 'image';

      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete file from Cloudinary: ${fileUrl}`,
        error,
      );
    }
  }
}
