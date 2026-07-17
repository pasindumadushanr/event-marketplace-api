import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerAccountService {
  constructor(private prisma: PrismaService) {}

  async getBookings(customerId: string) {
    return (this.prisma as any).booking.findMany({
      where: { customerId },
      include: {
        business: {
          select: { id: true, name: true, category: { select: { name: true } } }
        },
        package: {
          select: { id: true, name: true, duration: true }
        }
      },
      orderBy: { date: 'asc' }
    });
  }

  async getFavorites(customerId: string) {
    return (this.prisma as any).favoriteBusiness.findMany({
      where: { customerId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            coverImage: true,
            category: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addFavorite(customerId: string, businessId: string) {
    const business = await (this.prisma as any).business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    return (this.prisma as any).favoriteBusiness.create({
      data: { customerId, businessId }
    }).catch(() => null); // ignore if already exists (unique constraint)
  }

  async removeFavorite(customerId: string, businessId: string) {
    return (this.prisma as any).favoriteBusiness.deleteMany({
      where: { customerId, businessId }
    });
  }
}
