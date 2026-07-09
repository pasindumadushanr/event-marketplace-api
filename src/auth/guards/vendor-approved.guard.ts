import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorApprovedGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    if (!user || user.role !== 'VENDOR') {
      throw new ForbiddenException('Access restricted to vendors.');
    }

    // Check if the vendor's business is approved
    const business = await this.prisma.business.findFirst({
      where: { vendorId: user.userId },
      select: { vendorStatus: true }
    });

    if (!business) {
      throw new ForbiddenException('Vendor application not found. Please complete the onboarding process.');
    }

    if (business.vendorStatus !== 'APPROVED') {
      throw new ForbiddenException(`Access denied. Your business status is currently: ${business.vendorStatus}`);
    }

    return true;
  }
}
