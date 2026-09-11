import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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
        throw new ConflictException(
          'User with this phone number already exists',
        );
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
      where:
        roles && roles.length > 0
          ? {
              role: {
                name: { in: roles },
              },
            }
          : undefined,
      include: {
        role: true,
        businesses: { select: { createdAt: true } },
        vendorSubscriptions: {
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updateMe(id: string, data: any) {
    const allowedFields = ['firstName', 'lastName', 'phone', 'email', 'profileImage'];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Check if email or phone is already taken by someone else
    if (updateData.email || updateData.phone) {
      const orConditions: any[] = [];
      if (updateData.email) orConditions.push({ email: updateData.email });
      if (updateData.phone) orConditions.push({ phone: updateData.phone });

      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: orConditions,
          NOT: { id },
        },
      });

      if (existingUser) {
        if (existingUser.email === updateData.email) {
          throw new ConflictException('Email already in use');
        }
        if (existingUser.phone === updateData.phone) {
          throw new ConflictException('Phone number already in use');
        }
      }
    }

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
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
        profileImage: true,
      },
    });
  }

  async updatePassword(
    id: string,
    currentPassword?: string,
    newPassword?: string,
  ) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current and new password are required');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.password) {
      throw new BadRequestException('Invalid user or password not set');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async logoutAllDevices(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { hashedRefreshToken: null },
    });
    return { message: 'Logged out of all devices successfully' };
  }

  async updateRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
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

  async deleteAccount(userId: string) {
    // Delete favorite businesses first (has cascade but safe to be explicit)
    await this.prisma.favoriteBusiness.deleteMany({
      where: { customerId: userId },
    });

    // For customers testing this, it's mostly safe to just delete the user record
    // If they have bookings/businesses, we catch the foreign key error
    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
      return { success: true };
    } catch (error) {
      throw new ConflictException(
        'Cannot delete account because it has active bookings or businesses attached.',
      );
    }
  }
}
