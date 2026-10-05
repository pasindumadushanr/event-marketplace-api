import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorPackagesService {
  constructor(private prisma: PrismaService) {}

  private listingPrice(value: unknown) {
    if (value === undefined || value === null || value === '') return 0;
    if (!['number', 'string'].includes(typeof value))
      throw new BadRequestException(
        'Enter a valid price or leave it blank for price on request.',
      );
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 99999999.99)
      throw new BadRequestException('Enter a valid price of zero or more.');
    return price;
  }

  async getMyBusinessId(vendorId: string) {
    const business = await (this.prisma as any).business.findFirst({
      where: { vendorId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found.');
    return business.id;
  }

  async getPackages(vendorId: string) {
    const businessId = await this.getMyBusinessId(vendorId);
    return (this.prisma as any).package.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPackage(vendorId: string, data: any) {
    const businessId = await this.getMyBusinessId(vendorId);
    return (this.prisma as any).package.create({
      data: {
        name: data.name,
        description: data.description,
        image: data.image || null,
        price: this.listingPrice(data.price),
        features: data.features || [],
        duration: data.duration,
        status: data.status || 'ACTIVE',
        businessId,
      },
    });
  }

  async updatePackage(vendorId: string, id: string, data: any) {
    const businessId = await this.getMyBusinessId(vendorId);

    const pkg = await (this.prisma as any).package.findFirst({
      where: { id, businessId },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    return (this.prisma as any).package.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        image: data.image !== undefined ? data.image || null : undefined,
        price:
          data.price === undefined ? undefined : this.listingPrice(data.price),
        features: data.features,
        duration: data.duration,
        status: data.status,
      },
    });
  }

  async deletePackage(vendorId: string, id: string) {
    const businessId = await this.getMyBusinessId(vendorId);

    const pkg = await (this.prisma as any).package.findFirst({
      where: { id, businessId },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    return (this.prisma as any).package.delete({
      where: { id },
    });
  }
}
