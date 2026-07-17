import { Module } from '@nestjs/common';
import { VendorPackagesController } from './vendor-packages.controller';
import { VendorPackagesService } from './vendor-packages.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendorPackagesController],
  providers: [VendorPackagesService]
})
export class VendorPackagesModule {}
