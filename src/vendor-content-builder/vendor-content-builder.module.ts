import { Module } from '@nestjs/common';
import { VendorContentBuilderController } from './vendor-content-builder.controller';
import { VendorContentBuilderService } from './vendor-content-builder.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorContentBuilderController],
  providers: [VendorContentBuilderService],
})
export class VendorContentBuilderModule {}
