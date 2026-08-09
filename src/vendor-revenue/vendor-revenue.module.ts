import { Module } from '@nestjs/common';
import { VendorRevenueService } from './vendor-revenue.service';
import { VendorRevenueController } from './vendor-revenue.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorRevenueController],
  providers: [VendorRevenueService],
})
export class VendorRevenueModule {}
