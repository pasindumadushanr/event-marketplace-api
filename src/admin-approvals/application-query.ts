import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { descendantIds } from '../business-categories/category-tree';

export function applicationQuery(
  input: any,
  categories: { id: string; parentId: string | null }[],
) {
  for (const key of [
    'q',
    'district',
    'categoryId',
    'from',
    'to',
    'status',
    'page',
  ]) {
    if (
      input[key] !== undefined &&
      (typeof input[key] !== 'string' || input[key].length > 150)
    )
      throw new BadRequestException('Invalid application filter');
  }
  const page = Number(input.page || '1');
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new BadRequestException('Invalid page');
  const status = input.status || 'PENDING';
  const availableStatuses = {
    PENDING: ['PENDING', 'UNDER_REVIEW', 'NEEDS_INFO'],
    UNDER_REVIEW: ['UNDER_REVIEW'],
    NEEDS_INFO: ['NEEDS_INFO'],
    APPROVED: ['APPROVED'],
    REJECTED: ['REJECTED'],
    SUSPENDED: ['SUSPENDED'],
    ALL: undefined,
  };
  if (!Object.hasOwn(availableStatuses, status))
    throw new BadRequestException('Invalid application status');
  const statusFilter = availableStatuses[status];
  const where: Prisma.BusinessWhereInput = {
    vendorStatus: statusFilter ? { in: statusFilter as any } : undefined,
  };
  if (input.district?.trim())
    where.district = { equals: input.district.trim(), mode: 'insensitive' };
  if (input.q?.trim()) {
    const contains = { contains: input.q.trim(), mode: 'insensitive' as const };
    where.OR = [
      { name: contains },
      { email: contains },
      { phone: contains },
      {
        vendor: {
          is: {
            OR: [
              { firstName: contains },
              { lastName: contains },
              { email: contains },
            ],
          },
        },
      },
    ];
  }
  if (input.categoryId) {
    if (!categories.some((c) => c.id === input.categoryId))
      throw new BadRequestException('Category not found');
    where.categoryId = {
      in: descendantIds(categories as any, input.categoryId),
    };
  }
  const date = (value: string) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Invalid submission date');
    return new Date(`${value}T00:00:00+05:30`);
  };
  const from = input.from ? date(input.from) : undefined;
  const toStart = input.to ? date(input.to) : undefined;
  if (from && toStart && from > toStart)
    throw new BadRequestException('Start date must precede end date');
  const range = {
    gte: from,
    lt: toStart ? new Date(toStart.getTime() + 86400000) : undefined,
  };
  if (from || toStart) where.submittedAt = range;
  return { where, page, pageSize: 25 };
}
