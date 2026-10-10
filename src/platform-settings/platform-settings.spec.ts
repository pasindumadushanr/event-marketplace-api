import { ConfigService } from '@nestjs/config';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PlatformSettingsService } from './platform-settings.service';
import {
  defaultGeneral,
  defaultSeo,
  defaultSocial,
  validateSetting,
} from './validation';
import { AdminCmsService } from '../admin-cms/admin-cms.service';
import { AdminCmsController } from '../admin-cms/admin-cms.controller';
import { EmailService } from '../email/email.service';
import { ContactService } from '../contact/contact.service';
const config = (values: Record<string, string>) =>
  ({
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  }) as ConfigService;

describe('Connected platform settings', () => {
  let store: Map<string, any>;
  let db: any;
  let settings: PlatformSettingsService;
  beforeEach(() => {
    store = new Map();
    db = {
      setting: {
        findUnique: jest.fn(async ({ where }) =>
          store.has(where.key) ? { value: store.get(where.key) } : null,
        ),
        upsert: jest.fn(async ({ where, create, update }) => {
          const value = store.has(where.key) ? update.value : create.value;
          store.set(where.key, value);
          return { value };
        }),
      },
      adminActivity: { create: jest.fn() },
      user: {
        findUnique: jest.fn(async () => ({
          firstName: 'Admin',
          lastName: 'User',
        })),
      },
    };
    db.$transaction = jest.fn(async (callback) => callback(db));
    settings = new PlatformSettingsService(db, config({}));
  });
  it('returns safe defaults without writing records', async () => {
    const publicConfig = await settings.publicSettings();
    expect(publicConfig).toEqual({
      general: defaultGeneral,
      seo: defaultSeo,
      social: defaultSocial,
      analytics: { googleAnalyticsId: null },
    });
    expect(db.setting.upsert).not.toHaveBeenCalled();
  });
  it('never exposes legacy SMTP secrets or unrelated API keys', async () => {
    store.set('email', {
      smtpPassword: 'private-smtp',
      smtpUser: 'private-user',
      fromName: 'Celebrations',
    });
    store.set('apikeys', {
      googleMapsApiKey: 'private-maps',
      stripePublishableKey: 'unused-stripe',
      googleAnalyticsId: 'G-45Z4GT318V',
    });
    expect(await settings.read('email')).toEqual({ fromName: 'Celebrations' });
    const publicConfig = JSON.stringify(await settings.publicSettings());
    expect(publicConfig).toContain('G-45Z4GT318V');
    for (const secret of [
      'private-smtp',
      'private-user',
      'private-maps',
      'unused-stripe',
      'smtpPassword',
    ])
      expect(publicConfig).not.toContain(secret);
    expect(
      await new AdminCmsService(db, {} as any).getSetting('email'),
    ).toEqual({ fromName: 'Celebrations' });
  });
  it('preserves an explicit blank GA4 ID to disable environment fallback', async () => {
    store.set('apikeys', { googleAnalyticsId: '', _analyticsConfigured: true });
    settings = new PlatformSettingsService(
      db,
      config({ NEXT_PUBLIC_GA_ID: 'G-45Z4GT318V' }),
    );
    expect(await settings.read('apikeys')).toEqual({ googleAnalyticsId: '' });
  });
  it('uses footer legacy social links until the canonical social editor is saved', async () => {
    store.set('FOOTER_CONTENT', {
      socials: { instagram: 'https://instagram.com/old', facebook: '' },
    });
    let result: any = await settings.read('social');
    expect(result.instagram).toBe('https://instagram.com/old');
    expect(result.facebook).toBe('');
    store.set('social', {
      instagram: '',
      facebook: 'https://facebook.com/new',
    });
    result = await settings.read('social');
    expect(result.instagram).toBe('');
    expect(result.facebook).toBe('https://facebook.com/new');
  });
  it('preserves existing deployment analytics until an owner explicitly saves a blank ID in the new form', async () => {
    store.set('apikeys', { googleAnalyticsId: '', googleMapsApiKey: 'unused' });
    expect(await settings.read('apikeys')).toEqual({ googleAnalyticsId: null });
    await new AdminCmsService(db, {} as any).upsertSetting(
      'apikeys',
      { googleAnalyticsId: '' },
      { id: 'admin', roleName: 'ADMIN' },
    );
    expect(await settings.read('apikeys')).toEqual({ googleAnalyticsId: '' });
    expect(JSON.stringify(await settings.publicSettings())).not.toContain(
      '_analyticsConfigured',
    );
  });
  it('saving footer text preserves old links and never overrides newer canonical links', async () => {
    store.set('FOOTER_CONTENT', {
      socials: { instagram: 'https://instagram.com/old' },
      description: 'Old',
    });
    store.set('social', { instagram: 'https://instagram.com/new' });
    await new AdminCmsService(db, {} as any).upsertSetting(
      'FOOTER_CONTENT',
      { description: 'New', copyright: '', subtext: '' },
      { id: 'admin', roleName: 'ADMIN' },
    );
    expect(store.get('FOOTER_CONTENT').socials.instagram).toContain('/old');
    expect(store.get('social').instagram).toContain('/new');
  });
  it('old footer editor writes synchronize shared links without removing other networks', async () => {
    store.set('social', { youtube: 'https://youtube.com/channel/test' });
    await new AdminCmsService(db, {} as any).upsertSetting(
      'FOOTER_CONTENT',
      { socials: { instagram: 'https://instagram.com/new' } },
      { id: 'admin', roleName: 'ADMIN' },
    );
    expect(store.get('social')).toEqual({
      youtube: 'https://youtube.com/channel/test',
      instagram: 'https://instagram.com/new',
    });
  });
  it.each([
    ['general', { ...defaultGeneral, currency: 'USD' }],
    ['general', { ...defaultGeneral, contactEmail: 'invalid' }],
    ['social', { ...defaultSocial, facebook: 'javascript:alert(1)' }],
    [
      'social',
      { ...defaultSocial, instagram: 'https://user:secret@example.com' },
    ],
    ['apikeys', { googleAnalyticsId: "G-123');alert(1)//" }],
    ['apikeys', { googleAnalyticsId: 'G-45Z4GT318V', secretKey: 'secret' }],
    ['email', { fromName: 'Name', smtpPassword: 'private' }],
    ['email', { fromName: 'Name\r\nBcc: attacker@example.com' }],
    ['seo', { ...defaultSeo, metaDescription: '' }],
  ])('rejects unsafe or unsupported %s configuration', (key, value) => {
    expect(() => validateSetting(key as string, value)).toThrow();
  });
  it('reports mock email as not configured and never returns provider credentials', () => {
    expect(settings.emailStatus().configured).toBe(false);
    settings = new PlatformSettingsService(
      db,
      config({
        SMTP_PROVIDER: 'resend',
        SMTP_FROM_EMAIL: 'verified@example.com',
        RESEND_API_KEY: 'private-key',
      }),
    );
    expect(settings.emailStatus()).toEqual({
      provider: 'resend',
      configured: true,
      fromEmail: 'verified@example.com',
      credentialsManagedIn: 'Render environment variables',
    });
  });
  it('uses the saved sender display name for actual provider calls', async () => {
    store.set('email', { fromName: 'New name' });
    const provider = { sendMail: jest.fn(async () => true) };
    await new EmailService(provider, settings).sendMail(
      'recipient@example.com',
      'Subject',
      '<p>Test</p>',
    );
    expect(provider.sendMail).toHaveBeenCalledWith({
      to: 'recipient@example.com',
      subject: 'Subject',
      html: '<p>Test</p>',
      fromName: 'New name',
    });
  });
  it('continues email delivery with provider defaults if settings are unavailable', async () => {
    db.setting.findUnique.mockRejectedValue(new Error('offline'));
    const provider = { sendMail: jest.fn(async () => true) };
    expect(
      await new EmailService(provider, settings).sendMail(
        'recipient@example.com',
        'Subject',
        '<p>Test</p>',
      ),
    ).toBe(true);
    expect(provider.sendMail).toHaveBeenCalledWith({
      to: 'recipient@example.com',
      subject: 'Subject',
      html: '<p>Test</p>',
    });
  });
  it('delivers contact-form notifications to the saved support address', async () => {
    store.set('general', {
      ...defaultGeneral,
      contactEmail: 'owner-support@example.com',
    });
    db.contactSubmission = {
      create: jest.fn(async () => ({ id: 'contact-test' })),
    };
    const email = {
      sendContactConfirmation: jest.fn(async () => true),
      sendAdminContactNotification: jest.fn(async () => true),
    };
    await new ContactService(
      db,
      email as any,
      config({ SMTP_FROM_EMAIL: 'sender@example.com' }),
      settings,
    ).submitContactForm({
      name: 'Customer',
      email: 'customer@example.com',
      subject: 'Venue inquiry',
      message: 'Tell me about venues',
    });
    expect(email.sendAdminContactNotification).toHaveBeenCalledWith(
      'owner-support@example.com',
      'Customer',
      'customer@example.com',
      'Tell me about venues',
    );
  });
  it('protects email status and test routes with login and admin roles', () => {
    for (const name of ['getEmailStatus', 'testEmail']) {
      const method = AdminCmsController.prototype[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toHaveLength(2);
      expect(Reflect.getMetadata('roles', method)).toEqual([
        'ADMIN',
        'SUPER_ADMIN',
      ]);
    }
  });
  it('only sends a test to the authenticated account and refuses mock-provider tests', async () => {
    const email = { sendMail: jest.fn(async () => true) };
    let controller = new AdminCmsController({} as any, settings, email as any);
    await expect(
      controller.testEmail({ user: { email: 'admin@example.com' } }),
    ).rejects.toThrow('Configure a real email provider');
    settings = new PlatformSettingsService(
      db,
      config({
        SMTP_PROVIDER: 'resend',
        SMTP_FROM_EMAIL: 'verified@example.com',
        RESEND_API_KEY: 'key',
      }),
    );
    controller = new AdminCmsController({} as any, settings, email as any);
    await controller.testEmail({
      user: { email: 'admin@example.com' },
      body: { to: 'attacker@example.com' },
    });
    expect(email.sendMail).toHaveBeenCalledWith(
      'admin@example.com',
      'Platform email test',
      expect.any(String),
    );
  });
});
