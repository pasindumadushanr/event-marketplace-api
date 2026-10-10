import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  NotFoundException,
  Optional,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { managedKeys, validEmail } from '../platform-settings/validation';
import { EmailService } from '../email/email.service';
import { Throttle } from '@nestjs/throttler';
import { AdminCmsService } from './admin-cms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin/cms')
export class AdminCmsController {
  constructor(
    private readonly service: AdminCmsService,
    @Optional() private readonly settings?: PlatformSettingsService,
    @Optional() private readonly email?: EmailService,
  ) {}

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
  updateBanner(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.updateBanner(id, body, file);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteBanner(@Param('id') id: string) {
    return this.service.deleteBanner(id);
  }

  // FAQs
  @Get('public/faqs')
  getPublicFaqs() {
    return this.service.getPublicFaqs();
  }

  @Get('faqs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
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
  createBlogPost(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.createBlogPost(body, req.user.id, file);
  }

  @Patch('blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('coverImage'))
  updateBlogPost(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
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
  @Get('public/platform-settings')
  getPlatformSettings() {
    return this.settings!.publicSettings();
  }

  @Get('email/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getEmailStatus() {
    return this.settings!.emailStatus();
  }

  @Post('email/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  async testEmail(@Request() req: any) {
    if (!this.settings!.emailStatus().configured)
      throw new BadRequestException(
        'Configure a real email provider in Render before testing',
      );
    if (!validEmail(req.user.email || ''))
      throw new BadRequestException('Your account needs a valid email address');
    const sent = await this.email!.sendMail(
      req.user.email,
      'Platform email test',
      '<p>Your platform email service accepted this test message.</p>',
    );
    if (!sent)
      throw new ServiceUnavailableException(
        'Email provider rejected the test. Check the provider configuration in Render.',
      );
    return { accepted: true, recipient: req.user.email };
  }

  @Post('images/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadSiteImage(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadSiteImage(file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('settings/:key')
  async upsertSetting(
    @Param('key') key: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.service.upsertSetting(key, data.value, req.user);
  }

  @Get('public/settings/:key')
  async getSetting(@Param('key') key: string) {
    if (!['FOOTER_CONTENT', 'social', 'seo', 'SITE_MEDIA'].includes(key))
      throw new NotFoundException('Public setting not found');
    if (['seo', 'social'].includes(key) && this.settings)
      return this.settings.read(key);
    const setting = await this.service.getSetting(key);
    if (!setting) {
      throw new NotFoundException(`Setting ${key} not found`);
    }
    if (key === 'FOOTER_CONTENT' && this.settings)
      return {
        ...(setting as object),
        socials: await this.settings.read('social'),
      };
    return setting;
  }

  @Get('settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getPrivateSetting(@Param('key') key: string) {
    if (managedKeys.includes(key) && this.settings)
      return this.settings.read(key);
    if (key === 'FOOTER_CONTENT' && this.settings) {
      return {
        ...(((await this.service.getSetting(key)) || {}) as object),
        socials: await this.settings.read('social'),
      };
    }
    return this.service.getSetting(key);
  }
}
