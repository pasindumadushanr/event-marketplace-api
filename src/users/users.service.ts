import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { safeUserSelect } from './safe-user';
import { AdminActor, recordActivity } from '../admin-activity/activity';

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

  // Internal authentication queries must never be exposed by controllers.
  async findAuthByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findAuthById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: safeUserSelect,
    });
  }
  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }
  findSessionById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { ...safeUserSelect, sessionVersion: true },
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
      select: {
        ...safeUserSelect,
        businesses: { select: { createdAt: true } },
        vendorSubscriptions: {
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string, actor: AdminActor) {
    if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status))
      throw new BadRequestException('Invalid user status');
    if (id === actor.id)
      throw new BadRequestException(
        'You cannot change your own account status',
      );
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: {
          status: status as any,
          sessionVersion: { increment: 1 },
          hashedRefreshToken: null,
          otpPurpose: null,
          emailVerificationOtp: null,
          emailVerificationOtpExpiry: null,
        },
        select: safeUserSelect,
      });
      await recordActivity(
        tx,
        actor,
        'USER_STATUS_CHANGED',
        'USER',
        id,
        `Account status changed to ${status}`,
      );
      return result;
    });
  }

  async updateMe(id: string, data: any) {
    if (data.password !== undefined)
      throw new BadRequestException(
        'Use the password change form with your current password',
      );
    const allowedFields = [
      'firstName',
      'lastName',
      'phone',
      'email',
      'profileImage',
    ];
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
    if (
      typeof currentPassword !== 'string' ||
      !currentPassword ||
      !newPassword
    ) {
      throw new BadRequestException('Current and new password are required');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6)
      throw new BadRequestException('Password must be at least 6 characters');

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
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
        hashedRefreshToken: null,
        otpPurpose: null,
        emailVerificationOtp: null,
        emailVerificationOtpExpiry: null,
      },
    });

    return { message: 'Password updated successfully' };
  }

  async logoutAllDevices(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        hashedRefreshToken: null,
        sessionVersion: { increment: 1 },
        otpPurpose: null,
        emailVerificationOtp: null,
        emailVerificationOtpExpiry: null,
      },
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

  async consumeOtp(id: string, purpose: string, otp: string) {
    const result = await this.prisma.user.updateMany({
      where: {
        id,
        status: 'ACTIVE',
        otpPurpose: purpose,
        emailVerificationOtp: otp,
        emailVerificationOtpExpiry: { gt: new Date() },
      },
      data: {
        otpPurpose: null,
        emailVerificationOtp: null,
        emailVerificationOtpExpiry: null,
      },
    });
    if (result.count !== 1)
      throw new BadRequestException('Code expired or already used');
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
