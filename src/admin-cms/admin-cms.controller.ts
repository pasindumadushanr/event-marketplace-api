import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Request, NotFoundException } from '@nestjs/common';
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

  // Dynamic Pages (Admin)
  @Get('pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getPages() {
    return this.service.getPages();
  }

  @Post('pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  createPage(@Body() body: any) {
    return this.service.createPage(body);
  }

  @Patch('pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updatePage(@Param('id') id: string, @Body() body: any) {
    return this.service.updatePage(id, body);
  }

  @Delete('pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deletePage(@Param('id') id: string) {
    return this.service.deletePage(id);
  }

  // Dynamic Pages (Public)
  @Get('public/pages/:slug')
  getPublicPage(@Param('slug') slug: string) {
    return this.service.getPageBySlug(slug, true);
  }

  // Admin can fetch any page (draft or published) by slug to edit it
  @Get('pages/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAdminPage(@Param('slug') slug: string) {
    return this.service.getPageBySlug(slug, false);
  }


  // Blog Posts (Admin)
  @Get('blog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getBlogPosts() {
    return this.service.getBlogPosts();
  }

  @Post('blog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('coverImage'))
  createBlogPost(@Body() body: any, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.service.createBlogPost(body, req.user.userId, file);
  }

  @Patch('blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('coverImage'))
  updateBlogPost(@Param('id') id: string, @Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.updateBlogPost(id, body, file);
  }

  @Delete('blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteBlogPost(@Param('id') id: string) {
    return this.service.deleteBlogPost(id);
  }

  // Blog Posts (Public)
  @Get('public/blog')
  getPublicBlogPosts() {
    return this.service.getPublishedBlogPosts();
  }

  @Get('public/blog/:slug')
  getPublicBlogPost(@Param('slug') slug: string) {
    return this.service.getBlogPostBySlug(slug, true);
  }

  // Admin get specific blog post
  @Get('blog/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAdminBlogPost(@Param('slug') slug: string) {
    return this.service.getBlogPostBySlug(slug, false);
  }

  // SETTINGS ENDPOINTS
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('settings/:key')
  async upsertSetting(@Param('key') key: string, @Body() data: any) {
    return this.service.upsertSetting(key, data.value);
  }

  @Get('public/settings/:key')
  async getSetting(@Param('key') key: string) {
    const setting = await this.service.getSetting(key);
    if (!setting) {
      throw new NotFoundException(`Setting ${key} not found`);
    }
    return setting;
  }
}
