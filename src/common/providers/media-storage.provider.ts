import { Injectable, Logger } from '@nestjs/common';
import {
  CloudinaryQuotaExceededException,
  CloudinaryStorageProvider,
} from './cloudinary-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';
import { r2ObjectKey } from './r2-config';
import { StorageProvider } from './storage.provider';

@Injectable()
export class MediaStorageProvider implements StorageProvider {
  private readonly logger = new Logger(MediaStorageProvider.name);
  private readonly mode: 'cloudinary' | 'r2' | 'cloudinary-r2-fallback';
  private readonly invitationMode: 'inherit' | 'cloudinary' | 'r2';

  constructor(
    private readonly cloudinary: CloudinaryStorageProvider,
    private readonly r2: R2StorageProvider,
  ) {
    const mode = process.env.MEDIA_STORAGE_PROVIDER?.trim() || 'cloudinary';
    if (
      mode !== 'cloudinary' &&
      mode !== 'r2' &&
      mode !== 'cloudinary-r2-fallback'
    )
      throw new Error(
        'MEDIA_STORAGE_PROVIDER must be cloudinary, r2 or cloudinary-r2-fallback',
      );
    this.mode = mode;
    const invitationMode =
      process.env.INVITATION_MEDIA_STORAGE_PROVIDER?.trim() || 'inherit';
    if (!['inherit', 'cloudinary', 'r2'].includes(invitationMode))
      throw new Error(
        'INVITATION_MEDIA_STORAGE_PROVIDER must be inherit, cloudinary or r2',
      );
    this.invitationMode = invitationMode as 'inherit' | 'cloudinary' | 'r2';
    if (mode !== 'cloudinary' || invitationMode === 'r2') this.r2.configure();
  }

  async uploadFile(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<string> {
    // Only the invitation studio uses this server-selected folder.
    if (folder === 'wedding-invitations' && this.invitationMode !== 'inherit')
      return this.invitationMode === 'r2'
        ? this.r2.uploadFile(file, folder)
        : this.cloudinary.uploadFile(file, folder);
    if (this.mode === 'r2') return this.r2.uploadFile(file, folder);
    try {
      return await this.cloudinary.uploadFile(file, folder);
    } catch (error) {
      if (
        this.mode !== 'cloudinary-r2-fallback' ||
        !(error instanceof CloudinaryQuotaExceededException)
      )
        throw error;
      this.logger.warn(
        'Cloudinary reported a media quota limit; using R2 for this new upload.',
      );
      return this.r2.uploadFile(file, folder);
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Route by the saved URL, including when the upload provider has changed.
    if (r2ObjectKey(fileUrl)) return this.r2.deleteFile(fileUrl);
    return this.cloudinary.deleteFile(fileUrl);
  }
}
