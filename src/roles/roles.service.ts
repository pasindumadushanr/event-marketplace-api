import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findByName(name: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        _count: { select: { users: true } }
      }
    });
  }

  async findAllPermissions() {
    return this.prisma.permission.findMany({
      include: {
        _count: { select: { roles: true } }
      }
    });
  }
}
