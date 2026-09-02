import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../roles/roles.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private rolesService: RolesService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const requestedRoleName = registerDto.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
    const assignedRole = await this.rolesService.findByName(requestedRoleName);
    
    if (!assignedRole) {
      throw new BadRequestException('Roles not initialized in DB. Please seed the database.');
    }

    const { role, ...userData } = registerDto;

    const user = await this.usersService.create({
      ...userData,
      role: { connect: { id: assignedRole.id } },
    });

    return this.generateTokens(user.id, user.email, assignedRole.name, user.firstName, user.lastName);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Please login with your Google account.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email, (user as any).role.name, user.firstName, user.lastName);
  }

  async generateTokens(userId: string, email: string, roleName: string, firstName: string, lastName: string) {
    const payload = { sub: userId, email, role: roleName };
    const accessToken = this.jwtService.sign(payload);
    
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
    
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        roleName
      }
    };
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async validateOAuthLogin(profile: any) {
    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      const customerRole = await this.rolesService.findByName('CUSTOMER');
      if (!customerRole) {
        throw new BadRequestException('Roles not initialized in DB');
      }

      user = await this.usersService.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        profileImage: profile.profileImage,
        authProvider: 'google',
        googleId: profile.googleId,
        emailVerified: true,
        role: { connect: { id: customerRole.id } },
      });
    } else if (!user.googleId || !user.emailVerified) {
      // Link Google account and mark email as verified since Google verified it
      user = await this.usersService.updateUser(user.id, {
        googleId: profile.googleId,
        authProvider: 'google',
        emailVerified: true,
      });
    }

    return user;
  }

  async sendVerificationOtp(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email already verified');

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 15 mins from now
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15);

    await this.usersService.updateUser(userId, {
      emailVerificationOtp: otp,
      emailVerificationOtpExpiry: expiry,
    });

    // Send Email
    await this.emailService.sendOtpEmail(user.email, user.firstName, otp);

    return { message: 'OTP sent successfully' };
  }

  async verifyEmailOtp(userId: string, otp: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    if (!user.emailVerificationOtp || !user.emailVerificationOtpExpiry) {
      throw new BadRequestException('No OTP requested');
    }

    if (new Date() > user.emailVerificationOtpExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    if (user.emailVerificationOtp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.usersService.updateUser(userId, {
      emailVerified: true,
      emailVerificationOtp: null,
      emailVerificationOtpExpiry: null,
    });

    return { message: 'Email verified successfully' };
  }
}
