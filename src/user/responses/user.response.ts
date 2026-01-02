import { ApiProperty } from '@nestjs/swagger';
import { Provider, Role, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserResponse implements User {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @Exclude()
  password: string;

  @Exclude()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ isArray: true, enum: Role })
  roles: Role[];

  @Exclude()
  provider: Provider;

  @Exclude()
  isBlocked: boolean;

  @ApiProperty({ default: false })
  isVerified: boolean;

  constructor(user: User) {
    Object.assign(this, user);
  }
}
