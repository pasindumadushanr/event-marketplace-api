import { Test, TestingModule } from '@nestjs/testing';
import { BusinessCategoriesController } from './business-categories.controller';

describe('BusinessCategoriesController', () => {
  let controller: BusinessCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessCategoriesController],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<BusinessCategoriesController>(
      BusinessCategoriesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
