import { createHash } from 'node:crypto';

export const reviewRelations = {
  packages: { orderBy: { id: 'asc' as const } },
  galleries: { orderBy: { id: 'asc' as const } },
  documents: { orderBy: { id: 'asc' as const } },
  contentSections: { orderBy: { id: 'asc' as const } },
};

export function profileReviewDigest(business: any): string {
  const { setupReview, profileReviewDigest: _digest, ...settings } =
    business.profileSettings || {};
  const fields = [
    'name', 'description', 'categoryId', 'logo', 'coverImage', 'phone',
    'email', 'address', 'city', 'district', 'province', 'zipCode', 'country',
    'website', 'facebook', 'instagram', 'youtube', 'googleMapLocation',
    'verificationDocs', ...Object.keys(reviewRelations),
  ];
  const sort = (value: any): any => Array.isArray(value)
    ? value.map(sort)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]))
      : value;
  const data = JSON.parse(JSON.stringify([fields.map(key => business[key]), settings]));
  return createHash('sha256').update(JSON.stringify(sort(data))).digest('hex');
}

export function profileIsComplete(business: any) {
  return [
    business.name, business.description, business.logo, business.coverImage,
    business.phone, business.email, business.address, business.city,
    business.profileSettings?.policies?.bookingPolicy,
  ].every((value) => typeof value === 'string' && value.trim());
}
