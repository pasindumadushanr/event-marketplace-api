import {
  Controller,
  Get,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { taxonomyRows } from '../business-categories/category-taxonomy';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
  @Get('readiness')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async readiness() {
    await this.health();
    const columns = await this.prisma.$queryRaw<
      { present: boolean }[]
    >`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'BusinessCategory' AND column_name = 'parentId') AS present`;
    const emailConfigured =
      process.env.SMTP_PROVIDER === 'resend'
        ? Boolean(process.env.RESEND_API_KEY && process.env.SMTP_FROM_EMAIL)
        : process.env.SMTP_PROVIDER === 'smtp' &&
          Boolean(
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS &&
            process.env.SMTP_FROM_EMAIL,
          );
    const expectedSlugs = taxonomyRows().map((row) => row.slug);
    const categoryCount = await this.prisma.businessCategory.count({
      where: { slug: { in: expectedSlugs }, status: 'ACTIVE' },
    });
    return {
      categoryCatalog: categoryCount === expectedSlugs.length,
      database: true,
      categoryHierarchy: columns[0]?.present || false,
      emailConfigured,
      uploadsConfigured: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
      ),
      commit: process.env.RENDER_GIT_COMMIT || null,
    };
  }
}
