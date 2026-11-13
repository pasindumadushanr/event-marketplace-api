import { Test, TestingModule } from '@nestjs/testing';
import { CustomerAccountController } from './customer-account.controller';

describe('CustomerAccountController', () => {
  let controller: CustomerAccountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerAccountController],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<CustomerAccountController>(
      CustomerAccountController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
