import { Test, TestingModule } from '@nestjs/testing';
import { VendorBusinessService } from './vendor-business.service';

describe('VendorBusinessService', () => {
  let service: VendorBusinessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorBusinessService],
    }).compile();

    service = module.get<VendorBusinessService>(VendorBusinessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
