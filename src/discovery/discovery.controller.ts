import {
  Controller,
  Get,
  Post,
  Body,
  Header,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('sitemap')
  sitemap() {
    return this.discoveryService.getSitemap();
  }

  @Get('search')
  search(@Query() query: any) {
    return this.discoveryService.search(query);
  }

  // Coordinates stay out of URLs, access-log query strings and shared caches.
  @Post('nearby')
  @Header('Cache-Control', 'no-store')
  nearby(@Body() body: any) {
    return this.discoveryService.search(body, true);
  }

  @Get('packages')
  getFeaturedPackages(@Query('limit') limit?: number) {
    return this.discoveryService.getFeaturedPackages(limit);
  }

  @Get('vendors/:identifier')
  async getVendorProfile(@Param('identifier') identifier: string) {
    const profile = await this.discoveryService.getVendorProfile(identifier);
    if (!profile) {
      throw new NotFoundException('Business not found');
    }
    return profile;
  }
}
