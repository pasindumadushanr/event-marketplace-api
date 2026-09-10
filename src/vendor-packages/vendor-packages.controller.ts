import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VendorPackagesService } from './vendor-packages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('vendor/packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorPackagesController {
  constructor(private readonly service: VendorPackagesService) {}

  @Get()
  getPackages(@Request() req: any) {
    return this.service.getPackages(req.user.id);
  }

  @Post()
  createPackage(@Request() req: any, @Body() data: any) {
    return this.service.createPackage(req.user.id, data);
  }

  @Patch(':id')
  updatePackage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.service.updatePackage(req.user.id, id, data);
  }

  @Delete(':id')
  deletePackage(@Request() req: any, @Param('id') id: string) {
    return this.service.deletePackage(req.user.id, id);
  }
}
