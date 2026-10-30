import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudioAccessGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    const role = user?.role?.name;
    if (['SUPER_ADMIN', 'INVITATION_STAFF'].includes(role)) return true;
    // Marketplace administrators need an explicit owner-approved membership.
    if (role !== 'ADMIN') return false;
    return !!(await this.db.invitationStudioMember.findUnique({
      where: { userId: user.id },
    }));
  }
}
