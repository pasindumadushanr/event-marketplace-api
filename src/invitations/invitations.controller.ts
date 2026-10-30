import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioAccessGuard } from './studio-access.guard';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';
import { validateImageUpload } from '../admin-cms/site-media';
import { InvitationsService } from './invitations.service';

@Controller('invitation-studio')
@UseGuards(JwtAuthGuard, StudioAccessGuard)
export class InvitationStudioController {
  constructor(
    private readonly service: InvitationsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  @Get('session')
  session(@Request() req: any) {
    return { name: req.user.firstName, role: req.user.role.name };
  }
  @Get('settings')
  settings() {
    return this.service.settings();
  }
  @Post('settings')
  saveSettings(@Body() body: any) {
    return this.service.saveSettings(body);
  }
  @Get('invitations')
  list() {
    return this.service.list();
  }
  @Post('invitations')
  create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }
  @Get('invitations/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
  @Patch('invitations/:id')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.save(id, body, req.user.id);
  }
  @Post('invitations/:id/actions')
  action(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.action(id, body, req.user.id);
  }
  @Post('images')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() image: Express.Multer.File) {
    validateImageUpload(image);
    return { url: await this.storage.uploadFile(image, 'wedding-invitations') };
  }
}
@Controller('public/invitations')
export class PublicInvitationsController {
  constructor(private readonly service: InvitationsService) {}
  @Get('catalogue')
  @Header('Cache-Control', 'no-store')
  catalogue() {
    return this.service.settings();
  }
  @Post('review')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  review(@Body() body: any) {
    return this.service.review(body);
  }
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  get(@Param('slug') slug: string) {
    return this.service.publicInvitation(slug);
  }
}
