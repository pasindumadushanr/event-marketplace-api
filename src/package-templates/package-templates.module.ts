import { Module } from '@nestjs/common';
import { PackageTemplatesController } from './package-templates.controller';
import { PackageTemplatesService } from './package-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PackageTemplatesController],
  providers: [PackageTemplatesService],
  exports: [PackageTemplatesService],
})
export class PackageTemplatesModule {}
