import { Test, TestingModule } from '@nestjs/testing';
import { AdminApprovalsService } from './admin-approvals.service';

describe('AdminApprovalsService', () => {
  let service: AdminApprovalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminApprovalsService],
    }).compile();

    service = module.get<AdminApprovalsService>(AdminApprovalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
