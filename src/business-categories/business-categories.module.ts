import { Module } from '@nestjs/common';
import { BusinessCategoriesService } from './business-categories.service';
import { BusinessCategoriesController } from './business-categories.controller';

@Module({
  providers: [BusinessCategoriesService],
  controllers: [BusinessCategoriesController]
})
export class BusinessCategoriesModule {}
