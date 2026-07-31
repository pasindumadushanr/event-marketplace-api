import { User } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserEntity implements User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  @ApiPropertyOptional()
  phone: string | null;
  
  @Exclude()
  password: string | null;

  @ApiProperty()
  authProvider: string;

  @ApiPropertyOptional()
  googleId: string | null;
  
  @ApiPropertyOptional()
  profileImage: string | null;
  status: any;
  emailVerified: boolean;
  
  @Exclude()
  hashedRefreshToken: string | null;
  
  createdAt: Date;
  updatedAt: Date;
  roleId: string;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
