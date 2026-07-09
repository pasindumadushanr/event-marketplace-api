import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminApprovalsService {
  constructor(private prisma: PrismaService) {}

  async getApplications(status?: string) {
    return this.prisma.business.findMany({
      where: status ? { vendorStatus: status as any } : undefined,
      include: {
        vendor: { select: { firstName: true, lastName: true, email: true } },
        category: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveApplication(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Application not found');
    
    return this.prisma.business.update({
      where: { id },
      data: { vendorStatus: 'APPROVED', rejectionReason: null }
    });
  }

  async rejectApplication(id: string, reason: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Application not found');
    
    return this.prisma.business.update({
      where: { id },
      data: { vendorStatus: 'REJECTED', rejectionReason: reason }
    });
  }
}
