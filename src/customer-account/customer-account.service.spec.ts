import { Test, TestingModule } from '@nestjs/testing';
import { CustomerAccountService } from './customer-account.service';

describe('CustomerAccountService', () => {
  let service: CustomerAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerAccountService],
    }).compile();

    service = module.get<CustomerAccountService>(CustomerAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
