import { Test, TestingModule } from '@nestjs/testing';
import { BusinessCategoriesService } from './business-categories.service';

describe('BusinessCategoriesService', () => {
  let service: BusinessCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessCategoriesService],
    }).compile();

    service = module.get<BusinessCategoriesService>(BusinessCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
