import { Test, TestingModule } from '@nestjs/testing';
import { PackageTemplatesController } from './package-templates.controller';

describe('PackageTemplatesController', () => {
  let controller: PackageTemplatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageTemplatesController],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<PackageTemplatesController>(
      PackageTemplatesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
