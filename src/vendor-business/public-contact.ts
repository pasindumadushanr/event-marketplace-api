import { BadRequestException } from '@nestjs/common';

type SocialField = 'website' | 'facebook' | 'instagram' | 'youtube' | 'tiktok';
const hosts = {
  facebook: ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'],
  instagram: ['instagram.com', 'instagr.am'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
};
export function publicContactUrl(
  value: unknown,
  field: SocialField = 'website',
): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048)
    return null;
  const raw = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw))
    return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes('.')
    )
      return null;
    if (
      field !== 'website' &&
      !hosts[field].some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function whatsappNumber(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200 || !value.trim())
    return null;
  let raw = value.trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname !== 'wa.me' || url.username || url.password || url.port)
        return null;
      raw = url.pathname.slice(1);
    } catch {
      return null;
    }
  }
  if (!/^[+\d\s()-]+$/.test(raw)) return null;
  let number = raw.replace(/\D/g, '');
  if (number.startsWith('00')) number = number.slice(2);
  if (/^0\d{9}$/.test(number)) number = `94${number.slice(1)}`;
  return /^[1-9]\d{6,14}$/.test(number) ? number : null;
}
export function businessWhatsapp(settings: any): string | null {
  return whatsappNumber(
    settings && Object.prototype.hasOwnProperty.call(settings, 'whatsapp')
      ? settings.whatsapp
      : settings?.contact?.whatsapp,
  );
}
export function validatePublicContact(data: any) {
  for (const field of [
    'website',
    'facebook',
    'instagram',
    'youtube',
  ] as const) {
    if (data[field] === undefined || data[field] === null || data[field] === '')
      continue;
    const url = publicContactUrl(data[field], field);
    if (!url) throw new BadRequestException(`Enter a valid ${field} URL`);
    data[field] = url;
  }
  const settings = data.profileSettings;
  if (!settings) return;
  if (
    settings.tiktok !== undefined &&
    settings.tiktok !== null &&
    settings.tiktok !== ''
  ) {
    const url = publicContactUrl(settings.tiktok, 'tiktok');
    if (!url) throw new BadRequestException('Enter a valid TikTok URL');
    settings.tiktok = url;
  }
  for (const target of [settings, settings.contact]) {
    if (!target || typeof target !== 'object' || !('whatsapp' in target))
      continue;
    const value = target.whatsapp;
    if (value === '' || value === null) {
      target.whatsapp = '';
      continue;
    }
    const number = whatsappNumber(value);
    if (!number)
      throw new BadRequestException(
        'Enter a valid WhatsApp number with country code, e.g. +94771234567',
      );
    target.whatsapp = number;
  }
}
