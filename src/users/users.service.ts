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

    const { password, ...rest } = data;
    let hashedPassword: string | null = null;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    return this.prisma.user.create({
      data: {
        ...rest,
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

  async updateMe(id: string, data: any) {
    const { password, ...rest } = data;
    
    // Check if email or phone is already taken by someone else
    if (rest.email || rest.phone) {
      const orConditions: any[] = [];
      if (rest.email) orConditions.push({ email: rest.email });
      if (rest.phone) orConditions.push({ phone: rest.phone });
      
      const existingUser = await this.prisma.user.findFirst({
        where: { 
          OR: orConditions,
          NOT: { id }
        },
      });

      if (existingUser) {
        if (existingUser.email === rest.email) {
          throw new ConflictException('Email already in use');
        }
        if (existingUser.phone === rest.phone) {
          throw new ConflictException('Phone number already in use');
        }
      }
    }

    const updateData: any = { ...rest };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profileImage: true
      }
    });
  }

  async updateRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
