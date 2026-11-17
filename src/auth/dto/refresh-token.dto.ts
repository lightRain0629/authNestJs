import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// For clients without cookies (mobile). Browsers can omit it and rely on the cookie
export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'Refresh token from login. Optional when the refreshtoken cookie is sent',
    example: '9b2f6c1e-3a4d-4e8f-9c1b-2d7e5f6a8b90',
  })
  refreshToken?: string;
}
