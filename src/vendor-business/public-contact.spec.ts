import {
  businessWhatsapp,
  publicContactUrl,
  validatePublicContact,
  whatsappNumber,
} from './public-contact';
import { VendorBusinessService } from './vendor-business.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { DiscoveryService } from '../discovery/discovery.service';

describe('Vendor public contact details', () => {
  it.each([
    '0771234567',
    '+94 77 123 4567',
    '0094771234567',
    'https://wa.me/94771234567',
  ])('normalizes %s', (value) => {
    expect(whatsappNumber(value)).toBe('94771234567');
  });
  it.each([
    'javascript:1234567',
    'https://wa.me.evil.com/94771234567',
    'https://secret@wa.me/94771234567',
    'https://wa.me:1234/94771234567',
    'phone',
    '+000',
    771234567,
    null,
  ])('rejects invalid WhatsApp data %j', (value) => {
    expect(whatsappNumber(value)).toBeNull();
  });
  it('supports old nested numbers without undoing an explicit clear', () => {
    expect(businessWhatsapp({ contact: { whatsapp: '0771234567' } })).toBe(
      '94771234567',
    );
    expect(
      businessWhatsapp({ whatsapp: '', contact: { whatsapp: '0771234567' } }),
    ).toBeNull();
  });
  it('adds HTTPS to normal links, but blocks executable schemes and lookalike social domains', () => {
    expect(publicContactUrl('instagram.com/studio', 'instagram')).toBe(
      'https://instagram.com/studio',
    );
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,bad',
      'https://user:password@instagram.com/studio',
      'https://instagram.com.evil.com/studio',
    ]) {
      expect(publicContactUrl(value, 'instagram')).toBeNull();
    }
    expect(publicContactUrl('https://youtu.be/video', 'youtube')).toBe(
      'https://youtu.be/video',
    );
  });
  it('validates and normalizes both form and visual-editor contact fields', () => {
    const data = {
      facebook: 'facebook.com/studio',
      profileSettings: { whatsapp: '0771234567', tiktok: 'tiktok.com/@studio' },
    };
    validatePublicContact(data);
    expect(data).toEqual({
      facebook: 'https://facebook.com/studio',
      profileSettings: {
        whatsapp: '94771234567',
        tiktok: 'https://tiktok.com/@studio',
      },
    });
    expect(() =>
      validatePublicContact({
        profileSettings: { contact: { whatsapp: 'bad' } },
      }),
    ).toThrow('valid WhatsApp');
    expect(() =>
      validatePublicContact({ instagram: 'https://other-site.com' }),
    ).toThrow('valid instagram');
  });
  it('rejects unsafe edits before querying an account and preserves settings on valid updates', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({
        id: 'business',
        profileSettings: {
          categoryIds: ['photo', 'video'],
          policies: { bookingPolicy: 'Call first' },
        },
      });
    const update = jest.fn().mockResolvedValue({ id: 'business' });
    const service = new VendorBusinessService(
      { business: { findFirst, update } } as unknown as PrismaService,
      {} as EmailService,
    );
    await expect(
      service.updateMyBusiness('vendor', {
        profileSettings: { whatsapp: 'javascript:1234567' },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(findFirst).not.toHaveBeenCalled();
    await service.updateMyBusiness('vendor', {
      instagram: 'instagram.com/studio',
      profileSettings: { whatsapp: '0771234567' },
    });
    expect(findFirst).toHaveBeenCalledWith({ where: { vendorId: 'vendor' } });
    expect(update.mock.calls[0][0].data.profileSettings).toEqual({
      whatsapp: '94771234567',
      categoryIds: ['photo', 'video'],
      policies: { bookingPolicy: 'Call first' },
    });
  });
  it('exposes only an explicit public WhatsApp number in discovery, never the general phone or private settings', async () => {
    const rows = [
      {
        id: 'with',
        name: 'Studio',
        phone: '0711111111',
        profileSettings: { whatsapp: '0771234567', privateValue: 'not public' },
        packages: [],
        reviews: [],
      },
      {
        id: 'without',
        phone: '0711111111',
        profileSettings: {},
        packages: [],
        reviews: [],
      },
      {
        id: 'cleared',
        profileSettings: { whatsapp: '', contact: { whatsapp: '0771234567' } },
        packages: [],
        reviews: [],
      },
    ];
    const service = new DiscoveryService({
      business: {
        findMany: jest.fn().mockResolvedValue(rows),
        count: jest.fn().mockResolvedValue(3),
      },
    } as unknown as PrismaService);
    const result = await service.search({});
    expect(result.data.map((row) => row.whatsapp)).toEqual([
      '94771234567',
      null,
      null,
    ]);
    expect(result.data[0]).not.toHaveProperty('profileSettings');
    expect(result.data[0]).not.toHaveProperty('phone');
  });
});
