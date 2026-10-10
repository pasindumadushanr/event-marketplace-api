import { BadRequestException } from '@nestjs/common';

export const managedKeys = ['general', 'seo', 'social', 'apikeys', 'email'];
export const defaultGeneral = {
  siteName: 'Nakathata.lk',
  contactEmail: 'support@nakathata.lk',
  supportPhone: '',
  contactAddress: 'Sri Lanka',
  currency: 'LKR',
};
export const defaultSeo = {
  metaTitle: 'Nakathata.lk | Wedding Venues & Event Services in Sri Lanka',
  metaDescription:
    'Find wedding venues, photographers, bridal wear, cakes, wedding cars and event services across Sri Lanka. Explore vendors and contact your wedding team on Nakathata.lk.',
  keywords: 'events, weddings, photography, catering, sri lanka',
};
export const defaultSocial = {
  website: 'https://nakathata.lk',
  facebook: 'https://web.facebook.com/profile.php?id=61595001868271',
  instagram: 'https://www.instagram.com/nakathata.lk/',
  linkedin: '',
  twitter: '',
  youtube: 'https://www.youtube.com/channel/UCYSC4gU8KyQuhFn7p3RUjMw',
  tiktok: 'https://www.tiktok.com/@nakathata.lk',
};
export const fields: Record<string, string[]> = {
  general: Object.keys(defaultGeneral),
  seo: Object.keys(defaultSeo),
  social: Object.keys(defaultSocial),
  apikeys: ['googleAnalyticsId'],
  email: ['fromName'],
};
export function pickStrings(value: any, keys: string[]) {
  const result: Record<string, string> = {};
  for (const key of keys)
    if (typeof value?.[key] === 'string') result[key] = value[key].trim();
  return result;
}
export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
}
export function validateSetting(key: string, value: any) {
  if (!Object.prototype.hasOwnProperty.call(fields, key)) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Settings must be an object');
  if (Object.keys(value).some((name) => !fields[key].includes(name)))
    throw new BadRequestException(
      'Unsupported setting. Private credentials must be configured in Render.',
    );
  const result = pickStrings(value, fields[key]);
  if (Object.keys(result).length !== fields[key].length)
    throw new BadRequestException(
      'All setting fields must be provided as text',
    );
  for (const [name, text] of Object.entries(result)) {
    if (
      text.length >
        (name === 'metaDescription' || name === 'keywords' ? 1000 : 300) ||
      /[\u0000-\u001f]/.test(text)
    )
      throw new BadRequestException(`Invalid ${name}`);
  }
  if (key === 'general') {
    if (!result.siteName || !validEmail(result.contactEmail))
      throw new BadRequestException(
        'Enter a site name and valid support email',
      );
    if (result.currency !== 'LKR')
      throw new BadRequestException(
        'Only LKR is supported; currency conversion is not implemented',
      );
    if (result.supportPhone && !/^\+?[\d ()-]{7,25}$/.test(result.supportPhone))
      throw new BadRequestException('Enter a valid support phone number');
  }
  if (key === 'seo' && (!result.metaTitle || !result.metaDescription))
    throw new BadRequestException('SEO title and description are required');
  if (key === 'email' && !result.fromName)
    throw new BadRequestException('Sender name is required');
  if (
    key === 'apikeys' &&
    result.googleAnalyticsId &&
    !/^G-[A-Z0-9]{5,20}$/.test(result.googleAnalyticsId)
  )
    throw new BadRequestException(
      'Enter a valid GA4 measurement ID (G-...) or leave it empty to disable analytics',
    );
  if (key === 'social')
    for (const url of Object.values(result)) {
      if (!url) continue;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
          throw new Error();
      } catch {
        throw new BadRequestException(
          'Social links must be HTTPS URLs without credentials',
        );
      }
    }
  return result;
}
