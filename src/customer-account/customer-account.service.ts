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
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
          },
        },
        package: {
          select: { id: true, name: true, duration: true },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getFavorites(customerId: string) {
    const favorites = await this.prisma.favoriteBusiness.findMany({
      where: { customerId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            coverImage: true,
            logo: true,
            city: true,
            district: true,
            isVerified: true,
            status: true,
            vendorStatus: true,
            category: { select: { name: true } },
            packages: {
              where: { status: 'ACTIVE' },
              select: { name: true, price: true },
              orderBy: { createdAt: 'asc' },
            },
            reviews: { select: { rating: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map(({ business, ...favorite }) => {
      const { packages, reviews, status, vendorStatus, ...publicFields } =
        business;
      const available = status === 'ACTIVE' && vendorStatus === 'APPROVED';
      const prices = packages.map((item) => Number(item.price));
      return {
        ...favorite,
        business: {
          ...publicFields,
          isVerified: false,
          available,
          services: available ? packages.map((item) => item.name) : [],
          startingPrice: available && prices.length ? Math.min(...prices) : 0,
          hasQuoteOnlyServices: available && prices.some((price) => price <= 0),
          rating:
            available && reviews.length
              ? Number(
                  (
                    reviews.reduce((sum, review) => sum + review.rating, 0) /
                    reviews.length
                  ).toFixed(1),
                )
              : 0,
          reviewCount: available ? reviews.length : 0,
        },
      };
    });
  }

  async addFavorite(customerId: string, businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'ACTIVE', vendorStatus: 'APPROVED' },
    });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.favoriteBusiness.upsert({
      where: { customerId_businessId: { customerId, businessId } },
      create: { customerId, businessId },
      update: {},
    });
  }

  async removeFavorite(customerId: string, businessId: string) {
    return (this.prisma as any).favoriteBusiness.deleteMany({
      where: { customerId, businessId },
    });
  }
}
