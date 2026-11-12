import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../roles/roles.service';
import { EmailService } from '../email/email.service';
import { createHash, randomInt, randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private rolesService: RolesService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const requestedRoleName =
      registerDto.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
    const assignedRole = await this.rolesService.findByName(requestedRoleName);

    if (!assignedRole) {
      throw new BadRequestException(
        'Roles not initialized in DB. Please seed the database.',
      );
    }

    const { role, ...userData } = registerDto;

    const user = await this.usersService.create({
      ...userData,
      role: { connect: { id: assignedRole.id } },
    });

    return this.generateTokens(
      user.id,
      user.email,
      assignedRole.name,
      user.firstName,
      user.lastName,
    );
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findAuthByEmail(loginDto.email);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Please login with your Google account.');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roleName = (user as any).role.name;

    if (['ADMIN', 'SUPER_ADMIN', 'INVITATION_STAFF'].includes(roleName)) {
      const otp = randomInt(100000, 1000000).toString();
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + 15);

      await this.usersService.updateUser(user.id, {
        otpPurpose: 'ADMIN_LOGIN',
        emailVerificationOtp: otp,
        emailVerificationOtpExpiry: expiry,
      });

      const sent = await this.emailService.sendOtpEmail(
        user.email,
        user.firstName,
        otp,
      );
      if (!sent) {
        await this.usersService.updateUser(user.id, {
          otpPurpose: null,
          emailVerificationOtp: null,
          emailVerificationOtpExpiry: null,
        });
        throw new ServiceUnavailableException(
          'We could not send your sign-in email. Please try again shortly.',
        );
      }

      return {
        requiresOtp: true,
        userId: user.id,
        message: 'OTP sent to admin email.',
      };
    }

    return this.generateTokens(
      user.id,
      user.email,
      roleName,
      user.firstName,
      user.lastName,
    );
  }

  async verifyAdminLoginOtp(userId: string, otp: string) {
    const user = await this.usersService.findAuthById(userId);
    if (!user || user.status !== 'ACTIVE')
      throw new BadRequestException('User not found or inactive');

    const roleName = (user as any).role.name;
    if (!['ADMIN', 'SUPER_ADMIN', 'INVITATION_STAFF'].includes(roleName)) {
      throw new BadRequestException('Invalid role for admin login');
    }

    if (
      user.otpPurpose !== 'ADMIN_LOGIN' ||
      !user.emailVerificationOtp ||
      !user.emailVerificationOtpExpiry
    ) {
      throw new BadRequestException('No OTP requested');
    }

    if (new Date() > user.emailVerificationOtpExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    if (user.emailVerificationOtp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // Clear OTP
    await this.usersService.consumeOtp(userId, 'ADMIN_LOGIN', otp);

    return this.generateTokens(
      user.id,
      user.email,
      roleName,
      user.firstName,
      user.lastName,
    );
  }

  async generateTokens(
    userId: string,
    email: string,
    roleName: string,
    firstName: string,
    lastName: string,
    expectedVersion?: number,
  ) {
    const account = await this.usersService.findSessionById(userId);
    if (!account || account.status !== 'ACTIVE')
      throw new UnauthorizedException('Account is not active');
    if (
      expectedVersion !== undefined &&
      account.sessionVersion !== expectedVersion
    )
      throw new UnauthorizedException('Session expired. Please sign in again.');
    const payload = {
      sub: userId,
      email,
      role: account.role.name,
      sv: account.sessionVersion,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: '1h' },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: randomUUID() },
      { expiresIn: '7d' },
    );

    const salt = await bcrypt.genSalt(10);
    // Hash a fixed-length digest so bcrypt's 72-byte limit cannot truncate JWTs.
    const hashedRefreshToken = await bcrypt.hash(
      createHash('sha256').update(refreshToken).digest('hex'),
      salt,
    );

    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        roleName,
      },
    };
  }

  async logout(userId: string) {
    await this.usersService.logoutAllDevices(userId);
    return { message: 'Logged out successfully' };
  }

  async validateOAuthLogin(
    profile: any,
    intent: 'vendor' | 'customer' = 'customer',
  ) {
    if (!profile.googleId || !profile.email || profile.emailVerified !== true)
      throw new UnauthorizedException('Google email is not verified');
    const authoritativeEmail =
      /@gmail\.com$/i.test(profile.email) || !!profile.hostedDomain;
    let user = await this.usersService.findAuthByGoogleId(profile.googleId);
    if (!user) user = await this.usersService.findAuthByEmail(profile.email);

    if (!user) {
      const customerRole = await this.rolesService.findByName(
        intent === 'vendor' ? 'VENDOR' : 'CUSTOMER',
      );
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
        emailVerified: authoritativeEmail,
        role: { connect: { id: customerRole.id } },
      });
    } else if (
      ['ADMIN', 'SUPER_ADMIN', 'INVITATION_STAFF'].includes(
        (user as any).role?.name,
      )
    ) {
      throw new UnauthorizedException(
        'Administrators must use the admin login with email verification',
      );
    } else if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    } else if (intent === 'vendor' && (user as any).role?.name !== 'VENDOR') {
      throw new UnauthorizedException(
        'Use the customer login for this account',
      );
    } else if (user.googleId && user.googleId !== profile.googleId) {
      throw new UnauthorizedException('A different Google account is linked');
    } else if (!user.googleId || (!user.emailVerified && authoritativeEmail)) {
      if (!user.googleId && !authoritativeEmail)
        throw new UnauthorizedException(
          'Sign in with your password to verify this account',
        );
      user = await this.usersService.updateUser(user.id, {
        googleId: profile.googleId,
        // Keep password login working for existing password-based accounts.
        ...(user.password ? {} : { authProvider: 'google' }),
        ...(authoritativeEmail ? { emailVerified: true } : {}),
      });
    }

    // create/update helpers may omit the role relation. Reload before issuing
    // tokens so linking never accidentally issues a CUSTOMER session to a vendor.
    const authenticated = await this.usersService.findAuthById(user.id);
    if (
      !authenticated ||
      authenticated.status !== 'ACTIVE' ||
      !['CUSTOMER', 'VENDOR'].includes((authenticated as any).role?.name) ||
      (intent === 'vendor' && (authenticated as any).role?.name !== 'VENDOR')
    )
      throw new UnauthorizedException('Account unavailable');
    return authenticated;
  }

  async refresh(refreshToken: unknown) {
    if (typeof refreshToken !== 'string' || refreshToken.length > 4096)
      throw new UnauthorizedException('Session expired. Please sign in again.');
    let payload: { sub: string; type: string; sv: number };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string')
      throw new UnauthorizedException('Invalid session token');
    const user = await this.usersService.findAuthById(payload.sub);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.sessionVersion !== payload.sv ||
      !user.hashedRefreshToken ||
      !(await bcrypt.compare(
        createHash('sha256').update(refreshToken).digest('hex'),
        user.hashedRefreshToken,
      ))
    )
      throw new UnauthorizedException('Session expired. Please sign in again.');
    await this.usersService.consumeRefreshToken(
      user.id,
      user.hashedRefreshToken,
      user.sessionVersion,
    );
    return this.generateTokens(
      user.id,
      user.email,
      (user as any).role.name,
      user.firstName,
      user.lastName,
      payload.sv,
    );
  }

  async sendVerificationOtp(userId: string) {
    const user = await this.usersService.findAuthById(userId);
    if (!user) throw new BadRequestException('User not found');
    if (user.emailVerified)
      throw new BadRequestException('Email already verified');
    if (
      user.otpPurpose === 'EMAIL_VERIFY' &&
      user.emailVerificationOtpExpiry &&
      new Date(user.emailVerificationOtpExpiry).getTime() >
        Date.now() + 14 * 60000
    )
      throw new BadRequestException(
        'Please wait one minute before requesting another code',
      );

    // Generate 6 digit OTP
    const otp = randomInt(100000, 1000000).toString();

    // Set expiry to 15 mins from now
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15);

    await this.usersService.updateUser(userId, {
      otpPurpose: 'EMAIL_VERIFY',
      emailVerificationOtp: otp,
      emailVerificationOtpExpiry: expiry,
    });

    // Send Email
    const sent = await this.emailService.sendOtpEmail(
      user.email,
      user.firstName,
      otp,
    );
    if (!sent) {
      await this.usersService.updateUser(userId, {
        otpPurpose: null,
        emailVerificationOtp: null,
        emailVerificationOtpExpiry: null,
      });
      throw new ServiceUnavailableException(
        'We could not send your verification email. Please try again shortly.',
      );
    }
    return {
      message:
        'Verification email accepted for delivery. Please check your inbox and spam folder.',
    };
  }

  async verifyEmailOtp(userId: string, otp: string) {
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp))
      throw new BadRequestException('Enter a valid 6-digit code');
    const user = await this.usersService.findAuthById(userId);
    if (!user) throw new BadRequestException('User not found');

    if (
      user.otpPurpose !== 'EMAIL_VERIFY' ||
      !user.emailVerificationOtp ||
      !user.emailVerificationOtpExpiry
    ) {
      throw new BadRequestException('No OTP requested');
    }

    if (new Date() > user.emailVerificationOtpExpiry) {
      throw new BadRequestException('OTP has expired');
    }

    if (user.emailVerificationOtp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.usersService.consumeOtp(userId, 'EMAIL_VERIFY', otp);
    await this.usersService.updateUser(userId, {
      emailVerified: true,
      otpPurpose: null,
      emailVerificationOtp: null,
      emailVerificationOtpExpiry: null,
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findAuthByEmail(
      email.toLowerCase().trim(),
    );
    if (!user) {
      return {
        message:
          'If an account exists with this email, a reset code has been sent.',
      };
    }

    const otp = randomInt(100000, 1000000).toString();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15);

    await this.usersService.updateUser(user.id, {
      otpPurpose: 'RESET_PASSWORD',
      emailVerificationOtp: otp,
      emailVerificationOtpExpiry: expiry,
    });

    const sent = await this.emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      otp,
    );
    if (!sent)
      this.logger.warn(
        'Password reset email could not be delivered; check the email provider.',
      );

    return {
      message:
        'If an account exists with this email, a reset code has been sent.',
    };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    if (!email || !otp || !newPassword) {
      throw new BadRequestException(
        'Email, OTP, and new password are required',
      );
    }

    const user = await this.usersService.findAuthByEmail(
      email.toLowerCase().trim(),
    );
    if (!user) {
      throw new BadRequestException('Invalid email or reset code');
    }

    if (
      user.otpPurpose !== 'RESET_PASSWORD' ||
      !user.emailVerificationOtp ||
      !user.emailVerificationOtpExpiry
    ) {
      throw new BadRequestException('No password reset requested');
    }

    if (new Date() > user.emailVerificationOtpExpiry) {
      throw new BadRequestException(
        'Reset code has expired. Please request a new one.',
      );
    }

    if (user.emailVerificationOtp !== otp.trim()) {
      throw new BadRequestException('Invalid reset code');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.usersService.updateUser(user.id, {
      password: hashedPassword,
      otpPurpose: null,
      sessionVersion: { increment: 1 },
      hashedRefreshToken: null,
      emailVerificationOtp: null,
      emailVerificationOtpExpiry: null,
    });

    return { message: 'Password reset successfully. You can now log in.' };
  }
}
