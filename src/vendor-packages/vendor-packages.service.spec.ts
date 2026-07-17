import { Test, TestingModule } from '@nestjs/testing';
import { VendorPackagesService } from './vendor-packages.service';

describe('VendorPackagesService', () => {
  let service: VendorPackagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorPackagesService],
    }).compile();

    service = module.get<VendorPackagesService>(VendorPackagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
