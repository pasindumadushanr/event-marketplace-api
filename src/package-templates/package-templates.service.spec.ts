import { Test, TestingModule } from '@nestjs/testing';
import { PackageTemplatesService } from './package-templates.service';

describe('PackageTemplatesService', () => {
  let service: PackageTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackageTemplatesService],
    }).compile();

    service = module.get<PackageTemplatesService>(PackageTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
