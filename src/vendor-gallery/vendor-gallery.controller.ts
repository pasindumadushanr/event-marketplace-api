import { Controller, Get, Post, Patch, Delete, Param, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { VendorGalleryService } from './vendor-gallery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Ensure uploads directory exists
const uploadPath = './uploads/vendor-gallery';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

@Controller('vendor/gallery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorGalleryController {
  constructor(private readonly service: VendorGalleryService) {}

  @Get()
  getGallery(@Request() req: any) {
    return this.service.getGallery(req.user.userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadPath,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|mp4)$/)) {
        return cb(new BadRequestException('Only images and videos are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  }))
  async uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    
    // Construct local URL
    const fileUrl = `/uploads/vendor-gallery/${file.filename}`;
    const type = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    
    return this.service.addGalleryItem(req.user.userId, fileUrl, type);
  }

  @Delete(':id')
  deleteItem(@Request() req: any, @Param('id') id: string) {
    // Note: To be fully clean, we should also delete the file using fs.unlinkSync here.
    return this.service.deleteGalleryItem(req.user.userId, id);
  }

  @Patch(':id/cover')
  setCover(@Request() req: any, @Param('id') id: string) {
    return this.service.setCoverImage(req.user.userId, id);
  }
}
