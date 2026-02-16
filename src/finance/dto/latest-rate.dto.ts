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
  @Matches(/^[A-Z]{3}$/, {
    message: 'Base currency must be a 3-letter ISO code in uppercase',
  })
  base: string;

  @ApiProperty({
    description: 'Quote currency ISO code',
    example: 'EUR',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Quote currency must be a 3-letter ISO code in uppercase',
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
