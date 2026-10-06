import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('admin/activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminActivityController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@Query('page') pageValue = '1') {
    const page = Number(pageValue);
    if (
      typeof pageValue !== 'string' ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000
    )
      throw new BadRequestException('Invalid page');
    const pageSize = 25;
    const [total, items] = await Promise.all([
      this.prisma.adminActivity.count(),
      this.prisma.adminActivity.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);
    return { total, page, pageSize, items };
  }
}
