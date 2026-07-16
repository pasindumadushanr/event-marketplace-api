import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { VendorContentBuilderService } from './vendor-content-builder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('vendor/business/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorContentBuilderController {
  constructor(private readonly service: VendorContentBuilderService) {}

  @Get()
  getBlocks(@Request() req: any) {
    return this.service.getBlocks(req.user.id);
  }

  @Post()
  createBlock(@Request() req: any, @Body() data: any) {
    return this.service.createBlock(req.user.id, data);
  }

  @Patch('reorder')
  reorderBlocks(@Request() req: any, @Body() data: { blockIds: string[] }) {
    if (!data.blockIds || !Array.isArray(data.blockIds)) {
      throw new BadRequestException('Invalid block IDs array');
    }
    return this.service.reorderBlocks(req.user.id, data.blockIds);
  }

  @Patch(':id')
  updateBlock(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.service.updateBlock(req.user.id, id, data);
  }

  @Delete(':id')
  deleteBlock(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteBlock(req.user.id, id);
  }
}
