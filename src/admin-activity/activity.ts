import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type AdminActor = {
  id: string;
  firstName?: string;
  lastName?: string;
  role?: { name: string };
  roleName?: string;
};
export async function recordActivity(
  tx: Prisma.TransactionClient,
  actor: AdminActor,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
) {
  if (
    !actor?.id ||
    !['ADMIN', 'SUPER_ADMIN'].includes(actor.role?.name || actor.roleName || '')
  )
    throw new ForbiddenException('Administrator required');
  // Callers pass explicit safe descriptions, never request bodies or setting values.
  return tx.adminActivity.create({
    data: {
      actorId: actor.id,
      actorName:
        [actor.firstName, actor.lastName].filter(Boolean).join(' ') ||
        'Administrator',
      action,
      targetType,
      targetId,
      summary,
    },
  });
}
