import { User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity implements User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  
  @Exclude()
  password: string;
  
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
