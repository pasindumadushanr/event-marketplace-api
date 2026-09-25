import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { VendorPackagesService } from './vendor-packages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

@Controller('vendor/packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorPackagesController {
  constructor(
    private readonly service: VendorPackagesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Get()
  getPackages(@Request() req: any) {
    return this.service.getPackages(req.user.id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Only images (JPG, PNG, WEBP) are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadPackageImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    const fileUrl = await this.storage.uploadFile(file, 'packages');
    return { url: fileUrl };
  }

  @Post()
  createPackage(@Request() req: any, @Body() data: any) {
    return this.service.createPackage(req.user.id, data);
  }

  @Patch(':id')
  updatePackage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.service.updatePackage(req.user.id, id, data);
  }

  @Delete(':id')
  deletePackage(@Request() req: any, @Param('id') id: string) {
    return this.service.deletePackage(req.user.id, id);
  }
}
