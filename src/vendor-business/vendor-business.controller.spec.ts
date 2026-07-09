import { Test, TestingModule } from '@nestjs/testing';
import { VendorBusinessController } from './vendor-business.controller';

describe('VendorBusinessController', () => {
  let controller: VendorBusinessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorBusinessController],
    }).compile();

    controller = module.get<VendorBusinessController>(VendorBusinessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
