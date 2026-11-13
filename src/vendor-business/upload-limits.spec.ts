import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VendorBusinessController } from './vendor-business.controller';
import { VendorBusinessService } from './vendor-business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';

describe('Business image upload streaming limits', () => {
  let app: INestApplication;
  const uploadFile = jest
    .fn()
    .mockResolvedValue('https://example.test/logo.png');
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [VendorBusinessController],
      providers: [
        { provide: VendorBusinessService, useValue: {} },
        { provide: STORAGE_PROVIDER, useValue: { uploadFile } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => uploadFile.mockClear());
  afterAll(async () => app.close());
  it('rejects a file over 5MB before passing it to storage', async () => {
    await request(app.getHttpServer())
      .post('/vendor/business/upload')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(uploadFile).not.toHaveBeenCalled();
  });
  it('rejects extra multipart fields before storage', async () => {
    await request(app.getHttpServer())
      .post('/vendor/business/upload')
      .field('unexpected', 'data')
      .attach('file', Buffer.from('not an image'), {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(uploadFile).not.toHaveBeenCalled();
  });
  it('retains image-content validation', async () => {
    await request(app.getHttpServer())
      .post('/vendor/business/upload')
      .attach('file', Buffer.from('not an image'), {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(uploadFile).not.toHaveBeenCalled();
  });
});
