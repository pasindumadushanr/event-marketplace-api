import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageProvider } from './storage.provider';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<string> {
    try {
      const folderPath = path.join(this.uploadDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(folderPath, fileName);

      fs.writeFileSync(filePath, file.buffer);

      // Return public URL (assuming Next.js or a static server serves this, or NestJS static module)
      return `/uploads/${folder}/${fileName}`;
    } catch (error) {
      console.error('Local Storage Error:', error);
      throw new InternalServerErrorException('Failed to save file locally');
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl.startsWith('/uploads/')) return;
      const relativePath = fileUrl.replace('/uploads/', '');
      const filePath = path.join(this.uploadDir, relativePath);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete file locally:', error);
    }
  }
}
