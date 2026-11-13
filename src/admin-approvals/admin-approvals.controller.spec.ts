import { Test, TestingModule } from '@nestjs/testing';
import { AdminApprovalsController } from './admin-approvals.controller';

describe('AdminApprovalsController', () => {
  let controller: AdminApprovalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminApprovalsController],
    })
      // Construction smoke test: keep database, email and network dependencies isolated.
      .useMocker(() => ({}))
      .compile();

    controller = module.get<AdminApprovalsController>(AdminApprovalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
