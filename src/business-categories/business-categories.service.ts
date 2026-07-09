import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // We cast to any to bypass Prisma Client types not being fully generated due to EPERM
    return (this.prisma as any).businessCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { businesses: true } }
      }
    });
  }

  async findById(id: string) {
    return (this.prisma as any).businessCategory.findUnique({
      where: { id },
    });
  }

  async create(data: any) {
    const existing = await (this.prisma as any).businessCategory.findUnique({
      where: { slug: data.slug },
    });
    if (existing) throw new ConflictException('Category with this slug already exists');

    return (this.prisma as any).businessCategory.create({ data });
  }

  async update(id: string, data: any) {
    return (this.prisma as any).businessCategory.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: string) {
    return (this.prisma as any).businessCategory.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string) {
    const category = await (this.prisma as any).businessCategory.findUnique({
      where: { id },
      include: { _count: { select: { businesses: true } } }
    });

    if (category && category._count.businesses > 0) {
      throw new BadRequestException('Cannot delete category because it is assigned to businesses. Please deactivate it instead.');
    }

    return (this.prisma as any).businessCategory.delete({
      where: { id },
    });
  }
}
