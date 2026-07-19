import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) {}

  async search(query: any) {
    const { 
      q, 
      categoryId, 
      city, 
      minPrice, 
      maxPrice, 
      sortBy = 'NEWEST', 
      page = 1, 
      limit = 12 
    } = query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build the dynamic WHERE clause
    const where: Prisma.BusinessWhereInput = {
      status: 'ACTIVE', // Only show active businesses
    };

    if (q) {
      where.OR = [
        { name: { contains: String(q), mode: 'insensitive' } },
        { description: { contains: String(q), mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = String(categoryId);
    }

    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.packages = {
        some: {
          price: {
            gte: minPrice !== undefined ? Number(minPrice) : undefined,
            lte: maxPrice !== undefined ? Number(maxPrice) : undefined,
          }
        }
      };
    }

    // Determine Sorting
    let orderBy: any = { createdAt: 'desc' }; // Default NEWEST
    
    // Note: Prisma does not easily allow sorting by the minimum value of a relation field in a single query
    // For MVP, if PRICE_ASC/DESC or RATING_DESC is requested, we will handle it after fetching if needed,
    // or we can just stick to basic sorting. We will fetch packages to compute the starting price anyway.

    const [businesses, total] = await Promise.all([
      (this.prisma as any).business.findMany({
        where,
        include: {
          category: { select: { name: true } },
          packages: {
            select: { price: true },
            orderBy: { price: 'asc' }
          },
          reviews: {
            select: { rating: true }
          }
        },
        skip,
        take,
        orderBy
      }),
      (this.prisma as any).business.count({ where })
    ]);

    // Map the results to include computed fields for the VendorCard
    let mappedBusinesses = businesses.map(b => {
      // Calculate Starting Price
      const startingPrice = b.packages.length > 0 ? b.packages[0].price : 0;
      
      // Calculate Average Rating
      const totalRatings = b.reviews.reduce((acc, rev) => acc + rev.rating, 0);
      const avgRating = b.reviews.length > 0 ? (totalRatings / b.reviews.length).toFixed(1) : 0;

      return {
        id: b.id,
        name: b.name,
        coverImage: b.coverImage,
        logo: b.logo,
        isVerified: b.isVerified,
        city: b.city,
        category: b.category,
        startingPrice,
        rating: Number(avgRating),
        reviewCount: b.reviews.length,
        createdAt: b.createdAt
      };
    });

    // Apply advanced sorting in JS (since it involves computed relation aggregates)
    if (sortBy === 'PRICE_ASC') {
      mappedBusinesses.sort((a, b) => a.startingPrice - b.startingPrice);
    } else if (sortBy === 'PRICE_DESC') {
      mappedBusinesses.sort((a, b) => b.startingPrice - a.startingPrice);
    } else if (sortBy === 'RATING_DESC') {
      mappedBusinesses.sort((a, b) => b.rating - a.rating);
    }

    return {
      data: mappedBusinesses,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    };
  }

  async getVendorProfile(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    
    let business: any = null;

    if (isUuid) {
      business = await (this.prisma as any).business.findFirst({
        where: { id: identifier, status: 'ACTIVE' },
        include: {
          category: { select: { name: true, id: true } },
          galleries: { orderBy: { sortOrder: 'asc' } },
          packages: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
          reviews: {
            include: { customer: { select: { firstName: true, lastName: true, profileImage: true } } },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    } else {
      // Fallback for SEO Slug search
      const allActive = await (this.prisma as any).business.findMany({
        where: { status: 'ACTIVE' },
        include: {
          category: { select: { name: true, id: true } },
          galleries: { orderBy: { sortOrder: 'asc' } },
          packages: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
          reviews: {
            include: { customer: { select: { firstName: true, lastName: true, profileImage: true } } },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      business = allActive.find((b: any) => b.profileSettings?.seo?.slug === identifier);
    }

    if (!business) return null;

    const totalRatings = business.reviews.reduce((acc: any, rev: any) => acc + rev.rating, 0);
    const avgRating = business.reviews.length > 0 ? (totalRatings / business.reviews.length).toFixed(1) : 0;
    const startingPrice = business.packages.length > 0 ? business.packages[0].price : 0;

    return {
      ...business,
      rating: Number(avgRating),
      reviewCount: business.reviews.length,
      startingPrice
    };
  }
}
