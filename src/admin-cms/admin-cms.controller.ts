import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AdminCmsService } from './admin-cms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin/cms')
export class AdminCmsController {
  constructor(private readonly service: AdminCmsService) {}

  // Banners
  @Get('banners/active')
  getActiveBanners() {
    return this.service.getActiveBanners();
  }

  @Get('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAllBanners() {
    return this.service.getBanners();
  }

  @Post('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('image'))
  createBanner(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.createBanner(body, file);
  }

  @Patch('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('image'))
  updateBanner(@Param('id') id: string, @Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.updateBanner(id, body, file);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteBanner(@Param('id') id: string) {
    return this.service.deleteBanner(id);
  }

  // FAQs
  @Get('faqs')
  getFaqs() {
    return this.service.getFaqs();
  }

  @Post('faqs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  createFaq(@Body() body: any) {
    return this.service.createFaq(body);
  }

  @Patch('faqs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateFaq(@Param('id') id: string, @Body() body: any) {
    return this.service.updateFaq(id, body);
  }

  @Delete('faqs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteFaq(@Param('id') id: string) {
    return this.service.deleteFaq(id);
  }
}
