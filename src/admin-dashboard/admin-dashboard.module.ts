import { Module } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaUsageController } from './media-usage.controller';
import { MediaUsageService } from './media-usage.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminDashboardController, MediaUsageController],
  providers: [AdminDashboardService, MediaUsageService],
})
export class AdminDashboardModule {}
