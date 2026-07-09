import { Module } from '@nestjs/common';
import { VendorBusinessService } from './vendor-business.service';
import { VendorBusinessController } from './vendor-business.controller';

@Module({
  providers: [VendorBusinessService],
  controllers: [VendorBusinessController]
})
export class VendorBusinessModule {}
