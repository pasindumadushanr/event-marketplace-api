import { Test, TestingModule } from '@nestjs/testing';
import { PackageTemplatesService } from './package-templates.service';

describe('PackageTemplatesService', () => {
  let service: PackageTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackageTemplatesService],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    service = module.get<PackageTemplatesService>(PackageTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
