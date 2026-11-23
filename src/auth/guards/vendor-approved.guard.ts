import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorApprovedGuard implements CanActivate {
  protected readonly allowDraft: boolean = false;
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    if (!user || user.role?.name !== 'VENDOR' || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Access restricted to vendors.');
    }
    if (!user.emailVerified)
      throw new ForbiddenException(
        'Verify your email before using vendor tools.',
      );

    // Check if the vendor's business is approved
    const business = await this.prisma.business.findFirst({
      where: { vendorId: user.id },
      select: { vendorStatus: true },
    });

    if (!business) {
      throw new ForbiddenException(
        'Vendor application not found. Please complete the onboarding process.',
      );
    }

    if (business.vendorStatus !== 'APPROVED' &&
        !(this.allowDraft && ['PENDING', 'UNDER_REVIEW', 'NEEDS_INFO', 'REJECTED'].includes(business.vendorStatus))) {
      throw new ForbiddenException(
        `Access denied. Your business status is currently: ${business.vendorStatus}`,
      );
    }

    return true;
  }
}

@Injectable()
export class VendorWorkspaceGuard extends VendorApprovedGuard {
  protected override readonly allowDraft = true;
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}
