import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  descendantIds,
  isCategoryActive,
} from '../business-categories/category-tree';
import {
  legacyCategoryTargets,
  serviceCategoryAliases,
  taxonomyRows,
} from '../business-categories/category-taxonomy';
import { readCategories } from '../business-categories/category-reader';
import { withReviewEvidence } from '../reviews/review-evidence';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) {}

  async getSitemap() {
    const businesses = await this.prisma.business.findMany({
      where: { status: 'ACTIVE', vendorStatus: 'APPROVED' },
      select: { id: true, updatedAt: true, profileSettings: true },
      orderBy: { id: 'asc' },
    });
    return businesses.map((business) => ({
      slug: (business.profileSettings as any)?.seo?.slug || business.id,
      updatedAt: business.updatedAt,
    }));
  }

  async search(query: any) {
    const {
      q,
      categoryId,
      categorySlug,
      city,
      minPrice,
      maxPrice,
      sortBy = 'NEWEST',
      page = 1,
      limit = 12,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    if (
      !Number.isInteger(Number(page)) ||
      Number(page) < 1 ||
      !Number.isInteger(take) ||
      take < 1 ||
      take > 100
    )
      throw new BadRequestException(
        'Use a positive page and a limit between 1 and 100',
      );
    if (
      ![minPrice, maxPrice].every(
        (value) =>
          value === undefined ||
          (Number.isFinite(Number(value)) && Number(value) >= 0),
      )
    )
      throw new BadRequestException('Prices must be non-negative numbers');
    const aggregateSort = ['PRICE_ASC', 'PRICE_DESC', 'RATING_DESC'].includes(
      sortBy,
    );

    // Build the dynamic WHERE clause
    const where: Prisma.BusinessWhereInput = {
      status: 'ACTIVE', // Only show active businesses
      vendorStatus: 'APPROVED',
      // Temporarily disabling subscription check for MVP testing
      // vendor: {
      //   vendorSubscriptions: {
      //     some: {
      //       status: 'ACTIVE'
      //     }
      //   }
      // }
    };

    if (q) {
      where.OR = [
        { name: { contains: String(q), mode: 'insensitive' } },
        { description: { contains: String(q), mode: 'insensitive' } },
      ];
    }

    if (categoryId || categorySlug) {
      const { rows: nodes, hierarchyAvailable } = await readCategories(
        this.prisma,
      );
      const requested = categoryId
        ? nodes.find((node) => node.id === String(categoryId))
        : nodes.find((node) => node.slug === String(categorySlug));
      const aliasSlug = requested?.slug || String(categorySlug);
      const target =
        requested?.status === 'ACTIVE'
          ? requested
          : nodes.find(
              (node) =>
                node.slug ===
                (serviceCategoryAliases[aliasSlug] ||
                  legacyCategoryTargets[aliasSlug]),
            );
      let ids = target ? descendantIds(nodes, target.id) : [];
      if (!target && !hierarchyAvailable && categorySlug && !categoryId) {
        const catalog = taxonomyRows();
        let row = catalog.find((item) => item.slug === String(categorySlug));
        while (row?.parentSlug)
          row = catalog.find((item) => item.slug === row!.parentSlug);
        if (row)
          ids = nodes
            .filter(
              (node) =>
                legacyCategoryTargets[node.slug] === row!.slug &&
                node.status === 'ACTIVE',
            )
            .map((node) => node.id);
      }
      const visible = nodes.filter((node) => isCategoryActive(nodes, node.id));
      where.categoryId = {
        in: ids.filter((id) => visible.some((node) => node.id === id)),
      };
    }

    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.packages = {
        some: {
          status: 'ACTIVE',
          price: {
            gte: minPrice !== undefined ? Number(minPrice) : undefined,
            lte: maxPrice !== undefined ? Number(maxPrice) : undefined,
          },
        },
      };
    }

    // Determine Sorting
    const orderBy: any = { createdAt: 'desc' }; // Default NEWEST

    // Note: Prisma does not easily allow sorting by the minimum value of a relation field in a single query
    // For MVP, if PRICE_ASC/DESC or RATING_DESC is requested, we will handle it after fetching if needed,
    // or we can just stick to basic sorting. We will fetch packages to compute the starting price anyway.

    const [businesses, total] = await Promise.all([
      (this.prisma as any).business.findMany({
        where,
        include: {
          category: { select: { name: true } },
          packages: {
            where: { status: 'ACTIVE' },
            select: { price: true },
            orderBy: { price: 'asc' },
          },
          reviews: {
            select: { rating: true },
          },
        },
        ...(aggregateSort ? {} : { skip, take }),
        orderBy: [orderBy, { id: 'asc' }],
      }),
      (this.prisma as any).business.count({ where }),
    ]);

    // Map the results to include computed fields for the VendorCard
    const mappedBusinesses = businesses.map((b) => {
      // Calculate Starting Price
      const startingPriceObj = b.packages.length > 0 ? b.packages[0].price : 0;
      const startingPrice =
        typeof startingPriceObj === 'object' && startingPriceObj !== null
          ? Number(startingPriceObj.toString())
          : Number(startingPriceObj);

      // Calculate Average Rating
      const totalRatings = b.reviews.reduce((acc, rev) => acc + rev.rating, 0);
      const avgRating =
        b.reviews.length > 0 ? (totalRatings / b.reviews.length).toFixed(1) : 0;

      return {
        id: b.id,
        name: b.name,
        coverImage: b.coverImage,
        logo: b.logo,
        // Legacy flags have no recorded identity/registration evidence.
        isVerified: false,
        city: b.city,
        category: b.category,
        startingPrice,
        rating: Number(avgRating),
        reviewCount: b.reviews.length,
        createdAt: b.createdAt,
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
      data: aggregateSort
        ? mappedBusinesses.slice(skip, skip + take)
        : mappedBusinesses,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getVendorProfile(identifier: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    let business: any = null;

    if (isUuid) {
      business = await (this.prisma as any).business.findFirst({
        where: {
          id: identifier,
          status: 'ACTIVE',
          vendorStatus: 'APPROVED',
        },
        include: {
          vendor: { select: { emailVerified: true } },
          category: { select: { name: true, id: true } },
          galleries: { orderBy: { sortOrder: 'asc' } },
          packages: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
          reviews: {
            include: {
              customer: {
                select: { firstName: true, lastName: true, profileImage: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          bookings: {
            where: {
              status: { in: ['CONFIRMED', 'COMPLETED'] },
              date: { gte: new Date(new Date().toISOString().slice(0, 10)) },
            },
            select: { date: true },
          },
        },
      });
    } else {
      // Fallback for SEO Slug search
      business = await (this.prisma as any).business.findFirst({
        where: {
          status: 'ACTIVE',
          vendorStatus: 'APPROVED',
          profileSettings: { path: ['seo', 'slug'], equals: identifier },
        },
        include: {
          vendor: { select: { emailVerified: true } },
          category: { select: { name: true, id: true } },
          galleries: { orderBy: { sortOrder: 'asc' } },
          packages: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
          reviews: {
            include: {
              customer: {
                select: { firstName: true, lastName: true, profileImage: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          bookings: {
            where: {
              status: { in: ['CONFIRMED', 'COMPLETED'] },
              date: { gte: new Date(new Date().toISOString().slice(0, 10)) },
            },
            select: { date: true },
          },
        },
      });
    }

    if (!business) return null;

    const totalRatings = business.reviews.reduce(
      (acc: any, rev: any) => acc + rev.rating,
      0,
    );
    const avgRating =
      business.reviews.length > 0
        ? (totalRatings / business.reviews.length).toFixed(1)
        : 0;
    const startingPriceObj =
      business.packages.length > 0 ? business.packages[0].price : 0;
    const startingPrice =
      typeof startingPriceObj === 'object' && startingPriceObj !== null
        ? Number(startingPriceObj.toString())
        : Number(startingPriceObj);

    const { bookings, vendor, verificationDocs, ...publicBusiness } = business;
    const capacity = Number(business.profileSettings?.maxBookingsPerDay) || 1;
    const counts = new Map<string, number>();
    for (const item of bookings || []) {
      const key = item.date.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return {
      ...publicBusiness,
      isVerified: false,
      verification: {
        isBusinessVerified: false,
        isEmailVerified: vendor?.emailVerified === true,
        isPhoneVerified: false,
        isIdentityVerified: false,
        isRegistrationVerified: false,
      },
      reviews: await withReviewEvidence(
        this.prisma,
        business.id,
        business.reviews,
      ),
      unavailableDates: [
        ...new Set([
          ...(Array.isArray(business.profileSettings?.blockedDates)
            ? business.profileSettings.blockedDates
            : []),
          ...[...counts]
            .filter(([, count]) => count >= capacity)
            .map(([key]) => key),
        ]),
      ],
      rating: Number(avgRating),
      reviewCount: business.reviews.length,
      startingPrice,
    };
  }

  async getFeaturedPackages(limit = 4) {
    const packages = await (this.prisma as any).package.findMany({
      where: {
        status: 'ACTIVE',
        business: {
          status: 'ACTIVE',
          vendorStatus: 'APPROVED',
        },
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            city: true,
            coverImage: true,
            logo: true,
            profileSettings: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 4,
    });

    return packages.map((pkg: any) => ({
      ...pkg,
      price:
        typeof pkg.price === 'object' && pkg.price !== null
          ? Number(pkg.price.toString())
          : Number(pkg.price),
    }));
  }
}
