import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const orConditions: any[] = [{ email: data.email }];
    if (data.phone) {
      orConditions.push({ phone: data.phone });
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: orConditions },
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new ConflictException('User with this email already exists');
      }
      if (existingUser.phone === data.phone) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  async findAll(roles?: string[]) {
    return this.prisma.user.findMany({
      where: roles && roles.length > 0 ? {
        role: {
          name: { in: roles }
        }
      } : undefined,
      include: { role: true },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updateRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }
}
