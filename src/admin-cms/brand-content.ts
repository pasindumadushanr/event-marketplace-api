const BRAND_TEXT_FIELDS = new Set([
  'title',
  'subtitle',
  'question',
  'answer',
  'content',
  'description',
  'metaTitle',
  'metaDescription',
  'excerpt',
  'copyright',
  'subtext',
  'siteName',
  'fromName',
  'website',
  'link',
  'contactEmail',
  'fromEmail',
]);

/** Render legacy platform CMS copy under the current brand without rewriting
 * stored records, author details, slugs, asset URLs, or configuration secrets. */
export function currentBrandContent<T>(value: T): T {
  if (Array.isArray(value)) return value.map(currentBrandContent) as T;
  if (!value || typeof value !== 'object' || value instanceof Date)
    return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === 'string' && BRAND_TEXT_FIELDS.has(key)
        ? item
            .replace(
              /\b(?:luxeevents\.(?:fun|com)|eventmarketplace\.com)\b/gi,
              'nakathata.lk',
            )
            .replace(/\b(?:LuxeEvents|Event\s?Marketplace)\b/gi, 'Nakathata.lk')
        : currentBrandContent(item),
    ]),
  ) as T;
}
