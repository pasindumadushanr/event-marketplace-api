import { validateImageUpload, validateSiteMedia } from './site-media';
import { AdminCmsController } from './admin-cms.controller';
import { AdminCmsService } from './admin-cms.service';
import { GUARDS_METADATA } from '@nestjs/common/constants';
/* eslint-disable @typescript-eslint/unbound-method -- Reflect reads decorator metadata without invoking these methods. */

describe('Website images', () => {
  it('accepts only known image slots and category slugs', () => {
    expect(
      validateSiteMedia({
        heroImage: ' https://example.com/hero.jpg ',
        logoImage: '',
        categoryImages: { photographers: '/images/photo.jpg' },
      }),
    ).toEqual({
      heroImage: 'https://example.com/hero.jpg',
      logoImage: '',
      categoryImages: { photographers: '/images/photo.jpg' },
    });
    for (const value of [
      null,
      [],
      { apiKey: 'secret' },
      { heroImage: 'javascript:alert(1)' },
      { heroImage: '//example.com/x' },
      { heroImage: 'http://example.com/x' },
      { heroImage: 'https://user:pass@example.com/x' },
      { categoryImages: { '../bad': '' } },
    ])
      expect(() => validateSiteMedia(value)).toThrow();
  });
  it('validates uploaded bytes, type, and size before storage', () => {
    const png = {
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      size: 8,
      mimetype: 'image/png',
    } as Express.Multer.File;
    expect(validateImageUpload(png)).toBe(png);
    expect(() => validateImageUpload()).toThrow();
    expect(() =>
      validateImageUpload({ ...png, size: 6 * 1024 * 1024 }),
    ).toThrow();
    expect(() =>
      validateImageUpload({ ...png, buffer: Buffer.from('<script>') }),
    ).toThrow();
    expect(() =>
      validateImageUpload({ ...png, mimetype: 'image/svg+xml' }),
    ).toThrow();
  });
  it('guards uploads and settings writes, and refuses to expose private settings', async () => {
    const service = { getSetting: jest.fn().mockResolvedValue({}) };
    const controller = new AdminCmsController(
      service as unknown as AdminCmsService,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, controller.uploadSiteImage),
    ).toHaveLength(2);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, controller.upsertSetting),
    ).toHaveLength(2);
    expect(Reflect.getMetadata('roles', controller.uploadSiteImage)).toEqual([
      'ADMIN',
      'SUPER_ADMIN',
    ]);
    await expect(controller.getSetting('apikeys')).rejects.toThrow();
    expect(service.getSetting).not.toHaveBeenCalled();
    await expect(controller.getSetting('SITE_MEDIA')).resolves.toEqual({});
  });
});
