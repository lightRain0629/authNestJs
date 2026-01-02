import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListConversionsDto {
  @ApiPropertyOptional({
    description: 'Filter by from currency',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  fromCurrency?: string;

  @ApiPropertyOptional({
    description: 'Filter by to currency',
    example: 'EUR',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  toCurrency?: string;

  @ApiPropertyOptional({
    description: 'Filter from date',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter to date',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}
