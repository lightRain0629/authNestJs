import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @Length(6, 6)
  @ApiProperty({ example: '123456', description: 'OTP code sent to email' })
  code: string;
}
