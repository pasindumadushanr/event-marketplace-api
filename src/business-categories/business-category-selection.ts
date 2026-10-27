import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isCategoryActive, CategoryNode } from './category-tree';

// Retain the relational categoryId as the primary category for older clients.
// Additional selections live in the existing profileSettings JSON document.
export function businessCategoryIds(business: any): string[] {
  const extra = business?.profileSettings?.categoryIds;
  return [
    ...new Set(
      [business?.categoryId, ...(Array.isArray(extra) ? extra : [])].filter(
        (id): id is string => typeof id === 'string' && !!id,
      ),
    ),
  ];
}

export function categoryMembershipWhere(
  ids: string[],
): Prisma.BusinessWhereInput {
  return {
    OR: [
      { categoryId: { in: ids } },
      ...ids.map((id) => ({
        profileSettings: { path: ['categoryIds'], array_contains: [id] },
      })),
    ],
  };
}

export function prepareCategorySelection(
  data: any,
  previous: any,
  categories: CategoryNode[],
) {
  if (
    data.categoryId !== undefined &&
    (typeof data.categoryId !== 'string' || !data.categoryId)
  )
    throw new BadRequestException('Choose an active business category.');
  const primary = data.categoryId ?? previous?.categoryId;
  const supplied = data.categoryIds ?? data.profileSettings?.categoryIds;
  const hasSelection =
    'categoryIds' in data ||
    (data.profileSettings && 'categoryIds' in data.profileSettings);
  if (
    hasSelection &&
    (!Array.isArray(supplied) ||
      supplied.length > 30 ||
      supplied.some((id) => typeof id !== 'string' || !id.trim()))
  )
    throw new BadRequestException(
      'Category selections must be a list of category IDs',
    );
  if (
    data.categoryIds !== undefined &&
    data.profileSettings?.categoryIds !== undefined &&
    JSON.stringify(data.categoryIds) !==
      JSON.stringify(data.profileSettings.categoryIds)
  )
    throw new BadRequestException('Conflicting category selections');
  if (
    typeof primary !== 'string' ||
    !primary ||
    (primary !== previous?.categoryId && !isCategoryActive(categories, primary))
  )
    throw new BadRequestException('Choose an active business category.');
  const previousIds = businessCategoryIds(previous);
  const extras = hasSelection
    ? supplied
    : previousIds.filter((id) => id !== previous?.categoryId);
  const ids = [...new Set<string>([primary, ...extras])];
  if (ids.length > 10)
    throw new BadRequestException('Select at most 10 business categories');
  if (
    ids.some(
      (id) => !previousIds.includes(id) && !isCategoryActive(categories, id),
    )
  )
    throw new BadRequestException('Choose active business categories only.');
  delete data.categoryIds;
  if (hasSelection || Array.isArray(previous?.profileSettings?.categoryIds)) {
    data.profileSettings = {
      ...(data.profileSettings || {}),
      categoryIds: ids,
    };
  }
  return data;
}

export function displayedBusinessCategories(
  business: any,
  categories: (CategoryNode & { name: string; slug?: string })[],
) {
  return businessCategoryIds(business).flatMap((id) => {
    const node = categories.find((item) => item.id === id);
    if (node && isCategoryActive(categories, id))
      return [{ id, name: node.name, slug: node.slug }];
    // Preserve the legacy primary label, even if it has since been retired.
    return id === business.categoryId && business.category?.name
      ? [{ id, name: business.category.name, slug: business.category.slug }]
      : [];
  });
}
