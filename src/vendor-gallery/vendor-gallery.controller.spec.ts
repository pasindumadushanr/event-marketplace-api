import { Test, TestingModule } from '@nestjs/testing';
import { VendorGalleryController } from './vendor-gallery.controller';

describe('VendorGalleryController', () => {
  let controller: VendorGalleryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorGalleryController],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<VendorGalleryController>(VendorGalleryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
