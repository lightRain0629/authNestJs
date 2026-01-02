import { IsNotEmpty, IsString, MinLength, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPasswordsMatchingConstraint } from '@common/src/decorators/is-password-matching-constraint-decorator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'One-time token received via forgot password flow',
    example: '0b5033e0-2b3e-49ae-9c4d-3505e61eb5cb',
  })
  token: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({ minLength: 6, example: 'N3wStr0ngPass!' })
  password: string;

  @IsString()
  @MinLength(6)
  @Validate(IsPasswordsMatchingConstraint)
  @ApiProperty({
    minLength: 6,
    example: 'N3wStr0ngPass!',
    description: 'Must match password field',
  })
  passwordRepeat: string;
}
