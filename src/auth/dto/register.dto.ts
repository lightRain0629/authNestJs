import { IsPasswordsMatchingConstraint } from '@common/src/decorators/is-password-matching-constraint-decorator';
import { IsEmail, IsString, MinLength, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;
  @IsString()
  @MinLength(6)
  @ApiProperty({ minLength: 6, example: 'Str0ngPass!' })
  password: string;
  @IsString()
  @MinLength(6)
  @Validate(IsPasswordsMatchingConstraint)
  @ApiProperty({
    minLength: 6,
    example: 'Str0ngPass!',
    description: 'Must match password field',
  })
  passwordRepeat: string;
  @ApiProperty({
    required: false,
    example: 'device-123',
    description: 'Optional device identifier to bind session',
  })
  deviceId?: string;
}
