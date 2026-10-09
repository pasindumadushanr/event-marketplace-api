import { BadRequestException } from '@nestjs/common';

export const PUBLICATION_PREFIX = 'CMS_PUBLISHED:';
export const isPolicy = (slug: string) =>
  ['terms-and-conditions', 'privacy-policy'].includes(slug);

function text(value: unknown, name: string, max: number, required = true) {
  if (value === undefined && !required) return undefined;
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new BadRequestException(`${name} is required and must be valid text`);
  return value.trim();
}

export function faqInput(data: any, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new BadRequestException('Invalid FAQ');
  const result: any = {};
  for (const [key, max] of [
    ['question', 500],
    ['answer', 20000],
    ['category', 100],
  ] as const) {
    if (data[key] !== undefined || (!partial && key !== 'category'))
      result[key] = text(data[key], key, max);
  }
  if (!partial && result.category === undefined) result.category = 'GENERAL';
  if (data.isActive !== undefined) {
    if (typeof data.isActive !== 'boolean')
      throw new BadRequestException('Active must be a boolean');
    result.isActive = data.isActive;
  }
  if (data.sortOrder !== undefined) {
    if (!Number.isInteger(data.sortOrder) || Math.abs(data.sortOrder) > 100000)
      throw new BadRequestException('Sort order must be a whole number');
    result.sortOrder = data.sortOrder;
  }
  return result;
}

export function pageInput(data: any, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new BadRequestException('Invalid page');
  const result: any = {};
  if (!partial && typeof data.content !== 'string')
    throw new BadRequestException('Page content must be text');
  for (const [key, max] of [
    ['title', 300],
    ['slug', 150],
    ['content', 200000],
    ['metaTitle', 300],
    ['metaDescription', 2000],
  ] as const) {
    if (
      data[key] !== undefined ||
      (!partial && ['title', 'slug', 'content'].includes(key))
    )
      result[key] = text(
        data[key],
        key,
        max,
        !key.startsWith('meta') && key !== 'content',
      );
  }
  if (result.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug))
    throw new BadRequestException('Use a lowercase URL slug with hyphens');
  if (data.status !== undefined) {
    if (!['DRAFT', 'PUBLISHED'].includes(data.status))
      throw new BadRequestException('Invalid publication status');
    result.status = data.status;
  } else if (!partial) result.status = 'DRAFT';
  return result;
}

export function validatePublication(page: any) {
  if (
    !page.content
      ?.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  )
    throw new BadRequestException('Add page content before publishing');
}

export function publication(page: any) {
  return {
    title: page.title,
    slug: page.slug,
    content: page.content,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    status: 'PUBLISHED',
    updatedAt: new Date(page.updatedAt).toISOString(),
  };
}
