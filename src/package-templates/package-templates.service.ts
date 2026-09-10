import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PackageTemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.PackageTemplateCreateInput) {
    return this.prisma.packageTemplate.create({ data });
  }

  async findAll() {
    return this.prisma.packageTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.packageTemplate.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.PackageTemplateUpdateInput) {
    return this.prisma.packageTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.packageTemplate.delete({
      where: { id },
    });
  }
}
