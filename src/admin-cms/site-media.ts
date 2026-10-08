import { BadRequestException } from '@nestjs/common';

const fields = [
  'heroImage',
  'logoImage',
  'packageFallbackImage',
  'locationColombo',
  'locationKandy',
  'locationGalle',
  'locationNegombo',
];

function imageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new BadRequestException('Invalid image URL');
  const url = value.trim();
  if (!url || /^\/images\/[a-zA-Z0-9/_.-]+$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password)
      return url;
  } catch {
    /* Reject malformed URLs. */
  }
  throw new BadRequestException('Image URLs must use HTTPS');
}

export function validateSiteMedia(
  value: unknown,
): Record<string, string | Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid website images');
  const result: Record<string, string | Record<string, string>> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (fields.includes(key)) result[key] = imageUrl(item);
    else if (key === 'categoryImages') {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        Object.keys(item).length > 100
      )
        throw new BadRequestException('Invalid category images');
      const images: Record<string, string> = {};
      for (const [slug, url] of Object.entries(
        item as Record<string, unknown>,
      )) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
          throw new BadRequestException('Invalid category slug');
        images[slug] = imageUrl(url);
      }
      result.categoryImages = images;
    } else throw new BadRequestException('Unknown website image field');
  }
  return result;
}

export function validateImageUpload(file?: Express.Multer.File) {
  if (!file || !file.buffer || file.size > 5 * 1024 * 1024)
    throw new BadRequestException('Choose an image up to 5 MB');
  const b = file.buffer;
  const png = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp =
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP';
  if (!(
    (png && file.mimetype === 'image/png') ||
    (jpg && file.mimetype === 'image/jpeg') ||
    (webp && file.mimetype === 'image/webp')
  ))
    throw new BadRequestException(
      'Only PNG, JPEG and WebP images are supported',
    );
  return file;
}
