import { BadRequestException } from '@nestjs/common';
import { whatsappNumber } from '../vendor-business/public-contact';

export function invitationContent(input: any, publish = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Enter invitation details');
  const limits = {
    partnerOne: 80,
    partnerTwo: 80,
    welcome: 1000,
    venue: 160,
    address: 300,
    story: 3000,
    weddingAt: 40,
    rsvpPhone: 80,
    couplePhoto: 2048,
    mapUrl: 2048,
  };
  if (
    Object.keys(input).some(
      (k) => ![...Object.keys(limits), 'gallery', 'music'].includes(k),
    )
  )
    throw new BadRequestException('Unknown invitation field');
  const result: Record<string, any> = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = input[key] ?? '';
    if (
      typeof value !== 'string' ||
      value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    )
      throw new BadRequestException(`Invalid ${key}`);
    result[key] = value.trim();
  }
  const image = (value: string) => {
    if (!value || /^\/images\/invitations\/[a-zA-Z0-9_.-]+$/.test(value))
      return value;
    try {
      const u = new URL(value);
      if (
        u.protocol === 'https:' &&
        u.hostname === 'res.cloudinary.com' &&
        !u.username &&
        !u.password
      )
        return value;
    } catch {
      /* Invalid URL. */
    }
    throw new BadRequestException('Use an uploaded invitation image');
  };
  result.couplePhoto = image(result.couplePhoto);
  if (
    input.gallery !== undefined &&
    (!Array.isArray(input.gallery) || input.gallery.length > 8)
  )
    throw new BadRequestException('Choose up to 8 gallery images');
  result.gallery = (input.gallery || []).map((v: unknown) => {
    if (typeof v !== 'string' || v.length > 2048)
      throw new BadRequestException('Invalid gallery image');
    return image(v);
  });
  if (input.music !== undefined && typeof input.music !== 'boolean')
    throw new BadRequestException('Invalid music choice');
  result.music = input.music === true;
  if (result.rsvpPhone) {
    result.rsvpPhone = whatsappNumber(result.rsvpPhone);
    if (!result.rsvpPhone)
      throw new BadRequestException('Enter a valid RSVP WhatsApp number');
  }
  if (result.mapUrl) {
    try {
      const u = new URL(result.mapUrl);
      if (
        u.protocol !== 'https:' ||
        u.username ||
        u.password ||
        ![
          'maps.google.com',
          'www.google.com',
          'google.com',
          'maps.app.goo.gl',
          'goo.gl',
        ].includes(u.hostname)
      )
        throw new Error();
    } catch {
      throw new BadRequestException('Enter a Google Maps HTTPS link');
    }
  }
  if (
    result.weddingAt &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+05:30$/.test(result.weddingAt) ||
      !Number.isFinite(Date.parse(result.weddingAt)))
  )
    throw new BadRequestException(
      'Enter a valid wedding date and time (Sri Lanka)',
    );
  if (
    result.weddingAt &&
    new Date(Date.parse(result.weddingAt) + 330 * 60000)
      .toISOString()
      .slice(0, 19) +
      '+05:30' !==
      result.weddingAt
  )
    throw new BadRequestException('Enter a real calendar date and time');
  if (
    publish &&
    [
      'partnerOne',
      'partnerTwo',
      'welcome',
      'weddingAt',
      'venue',
      'address',
      'mapUrl',
      'rsvpPhone',
      'couplePhoto',
    ].some((k) => !result[k])
  )
    throw new BadRequestException(
      'Complete names, welcome, date/time, venue, address, map, photo and RSVP number before publishing',
    );
  return result;
}

export function invitationSlug(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 90 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
    ['demo', 'preview', 'new', 'catalogue', 'review'].includes(value)
  )
    throw new BadRequestException(
      'Use a unique link name with lowercase letters, numbers and hyphens (3–90 characters)',
    );
  return value;
}
