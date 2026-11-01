import { Module } from '@nestjs/common';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';
import { MediaStorageProvider } from './media-storage.provider';
import { STORAGE_PROVIDER } from './storage.provider';

@Module({
  providers: [
    CloudinaryStorageProvider,
    R2StorageProvider,
    MediaStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: MediaStorageProvider },
  ],
  exports: [STORAGE_PROVIDER],
})
export class MediaStorageModule {}
