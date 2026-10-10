import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  defaultGeneral,
  defaultSeo,
  defaultSocial,
  fields,
  pickStrings,
} from './validation';

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private async stored(key: string) {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value;
  }
  async read(key: string) {
    const value = await this.stored(key);
    if (key === 'general')
      return {
        ...defaultGeneral,
        ...pickStrings(value, fields.general),
        currency: 'LKR',
      };
    if (key === 'seo')
      return { ...defaultSeo, ...pickStrings(value, fields.seo) };
    if (key === 'social') {
      const footer: any = await this.stored('FOOTER_CONTENT');
      return {
        ...defaultSocial,
        ...pickStrings(footer?.socials, fields.social),
        ...pickStrings(value, fields.social),
      };
    }
    if (key === 'apikeys') {
      const saved = pickStrings(value, fields.apikeys).googleAnalyticsId;
      const managed =
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value['_analyticsConfigured'] === true;
      return {
        googleAnalyticsId:
          saved ||
          (managed
            ? ''
            : (this.config.get<string>('NEXT_PUBLIC_GA_ID') ?? null)),
      };
    }
    if (key === 'email')
      return { fromName: 'Nakathata.lk', ...pickStrings(value, fields.email) };
    return null;
  }
  async publicSettings() {
    const [general, seo, social, analytics] = await Promise.all(
      ['general', 'seo', 'social', 'apikeys'].map((key) => this.read(key)),
    );
    // Never return raw settings, SMTP credentials, or unrelated API keys.
    return { general, seo, social, analytics };
  }
  emailStatus() {
    const provider = this.config.get<string>('SMTP_PROVIDER', 'mock');
    const ready =
      provider === 'smtp'
        ? ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'].every(
            (key) => !!this.config.get(key),
          )
        : provider === 'resend' &&
          ['RESEND_API_KEY', 'SMTP_FROM_EMAIL'].every(
            (key) => !!this.config.get(key),
          );
    return {
      provider: ['smtp', 'resend'].includes(provider) ? provider : 'mock',
      configured: !!ready,
      fromEmail: this.config.get<string>('SMTP_FROM_EMAIL', ''),
      credentialsManagedIn: 'Render environment variables',
    };
  }
}
