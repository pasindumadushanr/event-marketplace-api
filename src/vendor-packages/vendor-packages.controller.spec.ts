import { Test, TestingModule } from '@nestjs/testing';
import { VendorPackagesController } from './vendor-packages.controller';

describe('VendorPackagesController', () => {
  let controller: VendorPackagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorPackagesController],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<VendorPackagesController>(VendorPackagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
