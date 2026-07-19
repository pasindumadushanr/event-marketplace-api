export interface StorageProvider {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
