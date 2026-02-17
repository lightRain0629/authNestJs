import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class SummaryDto {
  @ApiProperty({
    description: 'Start date for summary period',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({
    description: 'End date for summary period',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({
    description: 'Base currency for conversion totals',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  baseCurrency?: string;
}

export class ChartQueryDto {
  @ApiProperty({
    description: 'Start date for chart period',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({
    description: 'End date for chart period',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({
    description:
      'Convert all amounts to this currency. If omitted, amounts stay in their original currency.',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  baseCurrency?: string;
}
