import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRateDto {
  @ApiProperty({
    description: 'Base currency ISO code',
    example: 'USD',
    maxLength: 3,
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Base currency must be a 3-letter ISO code in uppercase',
  })
  baseCurrency: string;

  @ApiProperty({
    description: 'Quote currency ISO code',
    example: 'EUR',
    maxLength: 3,
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Quote currency must be a 3-letter ISO code in uppercase',
  })
  quoteCurrency: string;

  @ApiProperty({
    description: 'Exchange rate (quote per 1 base)',
    example: '0.92',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Rate must be a positive decimal string with up to 8 decimal places',
  })
  rate: string;

  @ApiPropertyOptional({
    description: 'Rate source (e.g., "manual", "API")',
    example: 'manual',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  source?: string;

  @ApiProperty({
    description: 'Effective date/time (ISO 8601)',
    example: '2024-01-15T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  effectiveAt: string;
}
