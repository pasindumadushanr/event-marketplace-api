import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { MediaUsageService } from './media-usage.service';

@Controller('admin/media-usage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class MediaUsageController {
  constructor(private readonly usage: MediaUsageService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  overview() {
    return this.usage.overview();
  }
}
