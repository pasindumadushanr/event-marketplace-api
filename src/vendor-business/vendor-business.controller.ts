import { Controller, Get, Post, Patch, Body, UseGuards, Request, UseInterceptors, UploadedFile, Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VendorBusinessService } from './vendor-business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

@Controller('vendor/business')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorBusinessController {
  constructor(
    private readonly service: VendorBusinessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const url = await this.storage.uploadFile(file, 'business');
    return { url };
  }

  @Get()
  getMyBusiness(@Request() req: any) {
    return this.service.getMyBusiness(req.user.id);
  }

  @Post('onboarding/wizard')
  submitOnboarding(@Request() req: any, @Body() data: any) {
    return this.service.submitOnboarding(req.user.id, data);
  }

  @Get('onboarding/status')
  getOnboardingStatus(@Request() req: any) {
    return this.service.getOnboardingStatus(req.user.id);
  }

  @Patch()
  updateMyBusiness(@Request() req: any, @Body() data: any) {
    return this.service.updateMyBusiness(req.user.id, data);
  }

  @Patch('publish')
  publishMyBusiness(@Request() req: any) {
    return this.service.publishMyBusiness(req.user.id);
  }

  @Patch('unpublish')
  unpublishMyBusiness(@Request() req: any) {
    return this.service.unpublishMyBusiness(req.user.id);
  }
}
