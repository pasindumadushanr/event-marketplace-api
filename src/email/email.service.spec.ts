import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: 'EMAIL_PROVIDER', useValue: { sendMail: jest.fn().mockResolvedValue(true) } }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends through the injected provider, without a real email connection', async () => {
    await expect(service.sendMail('test@example.com', 'Test', '<p>Test</p>')).resolves.toBe(true);
  });
});
