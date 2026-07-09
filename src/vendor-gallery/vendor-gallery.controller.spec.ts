import { Test, TestingModule } from '@nestjs/testing';
import { VendorGalleryController } from './vendor-gallery.controller';

describe('VendorGalleryController', () => {
  let controller: VendorGalleryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorGalleryController],
    }).compile();

    controller = module.get<VendorGalleryController>(VendorGalleryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
