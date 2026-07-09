import { Test, TestingModule } from '@nestjs/testing';
import { AdminApprovalsController } from './admin-approvals.controller';

describe('AdminApprovalsController', () => {
  let controller: AdminApprovalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminApprovalsController],
    }).compile();

    controller = module.get<AdminApprovalsController>(AdminApprovalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
