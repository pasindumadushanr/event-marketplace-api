import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private rolesService: RolesService,
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
}
