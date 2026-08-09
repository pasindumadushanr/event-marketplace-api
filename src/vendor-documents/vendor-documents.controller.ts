import { Controller, Get, Post, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Request } from '@nestjs/common';
import { VendorDocumentsService } from './vendor-documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('vendor/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorDocumentsController {
  constructor(private readonly vendorDocumentsService: VendorDocumentsService) {}

  @Get()
  getDocuments(@Request() req: any) {
    return this.vendorDocumentsService.getDocuments(req.user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Request() req: any,
    @Body('type') type: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.vendorDocumentsService.uploadDocument(req.user.id, type, file);
  }

  @Delete(':id')
  deleteDocument(
    @Request() req: any,
    @Param('id') id: string
  ) {
    return this.vendorDocumentsService.deleteDocument(req.user.id, id);
  }
}
