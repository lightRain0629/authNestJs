import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class LatestRateDto {
  @ApiProperty({
    description: 'Base currency ISO code',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Base currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  base: string;

  @ApiProperty({
    description: 'Quote currency ISO code',
    example: 'EUR',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Quote currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  quote: string;

  @ApiPropertyOptional({
    description: 'Target date for rate lookup (defaults to now)',
    example: '2024-01-15T10:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  asOf?: string;
}
