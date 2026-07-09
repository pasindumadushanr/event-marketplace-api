import { Test, TestingModule } from '@nestjs/testing';
import { VendorGalleryService } from './vendor-gallery.service';

describe('VendorGalleryService', () => {
  let service: VendorGalleryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorGalleryService],
    }).compile();

    service = module.get<VendorGalleryService>(VendorGalleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
