import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('CategoryReader');
const select = {
  id: true, name: true, slug: true, description: true, icon: true,
  coverImage: true, sortOrder: true, status: true,
} as const;

// Rolling deployments may run the new client before parentId is added to Neon.
// Only recover from this specific missing column; connection failures still surface.
export async function readCategories(prisma: PrismaService, withCounts = false) {
  const count = withCounts
    ? { _count: { select: { businesses: { where: { status: 'ACTIVE' as const } } } } }
    : {};
  const orderBy = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];
  try {
    const rows = await prisma.businessCategory.findMany({
      orderBy, select: { ...select, parentId: true, ...count },
    });
    return { rows, hierarchyAvailable: true };
  } catch (error) {
    const details = error as { code?: string; meta?: { column?: string }; message?: string };
    if (details.code !== 'P2022' || !`${details.meta?.column || ''} ${details.message || ''}`.includes('parentId')) throw error;
    logger.warn('BusinessCategory.parentId is missing. Serving existing categories; apply the category hierarchy migration.');
    const rows = await prisma.businessCategory.findMany({ orderBy, select: { ...select, ...count } });
    return { rows: rows.map((row) => ({ ...row, parentId: null })), hierarchyAvailable: false };
  }
}
