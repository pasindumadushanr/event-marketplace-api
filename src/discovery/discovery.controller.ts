import { Controller, Get, Query, Param, NotFoundException } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('search')
  search(@Query() query: any) {
    return this.discoveryService.search(query);
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
