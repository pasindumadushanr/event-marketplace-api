import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { StorageProvider } from './storage.provider';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

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

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `event_marketplace/${folder}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary Upload Error', error);
            return reject(new InternalServerErrorException('Failed to upload file to Cloudinary'));
          }
          if (result && result.secure_url) {
            resolve(result.secure_url);
          } else {
            reject(new InternalServerErrorException('Failed to get secure URL from Cloudinary'));
          }
        }
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl.includes('cloudinary.com')) return;
      
      // Extract public ID from URL
      // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567/folder/file_name.jpg
      const parts = fileUrl.split('/');
      const lastPart = parts.pop();
      if (!lastPart) return;
      
      const fileNameWithoutExt = lastPart.split('.')[0];
      const folderPath = parts.slice(parts.indexOf('upload') + 2).join('/'); // Skip 'upload' and version
      const publicId = folderPath ? `${folderPath}/${fileNameWithoutExt}` : fileNameWithoutExt;

      // Determine resource type based on URL (video or image)
      const resourceType = fileUrl.includes('/video/upload/') ? 'video' : 'image';

      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      this.logger.error(`Failed to delete file from Cloudinary: ${fileUrl}`, error);
    }
  }
}
