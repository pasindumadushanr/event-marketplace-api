import { Module } from '@nestjs/common';
import { VendorReviewsService } from './vendor-reviews.service';
import { VendorReviewsController } from './vendor-reviews.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorReviewsController],
  providers: [VendorReviewsService],
})
export class VendorReviewsModule {}
