import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @IsEmail()
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the account to reset password for',
  })
  email: string;
}
