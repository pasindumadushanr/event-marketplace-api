import { Controller, Get, Post, Patch, Delete, Param, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Body, Inject } from '@nestjs/common';
import { VendorGalleryService } from './vendor-gallery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

@Controller('vendor/gallery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorGalleryController {
  constructor(
    private readonly service: VendorGalleryService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  @Get()
  getGallery(@Request() req: any) {
    return this.service.getGallery(req.user.userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|mp4)$/)) {
        return cb(new BadRequestException('Only images and videos are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  }))
  async uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    
    // Upload via StorageProvider (Cloudinary)
    const fileUrl = await this.storage.uploadFile(file, 'gallery');
    const type = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    
    return this.service.addGalleryItem(req.user.userId, fileUrl, type);
  }

  @Delete(':id')
  deleteItem(@Request() req: any, @Param('id') id: string) {
    // Note: To be fully clean, we should also delete the file using fs.unlinkSync here.
    return this.service.deleteGalleryItem(req.user.userId, id);
  }

  @Patch('reorder')
  reorderItems(@Request() req: any, @Body() data: { itemIds: string[] }) {
    if (!data.itemIds || !Array.isArray(data.itemIds)) {
      throw new BadRequestException('Invalid item IDs array');
    }
    return this.service.reorderItems(req.user.userId, data.itemIds);
  }

  @Patch(':id/cover')
  setCover(@Request() req: any, @Param('id') id: string) {
    return this.service.setCoverImage(req.user.userId, id);
  }
}
