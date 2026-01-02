import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceRecordType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListRecordsDto {
  @ApiPropertyOptional({
    description: 'Filter by record type',
    enum: FinanceRecordType,
  })
  @IsEnum(FinanceRecordType)
  @IsOptional()
  type?: FinanceRecordType;

  @ApiPropertyOptional({
    description: 'Filter by currency ISO code',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filter by article ID',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  articleId?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (operationDate >= from)',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (operationDate <= to)',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Search text in remark and article name',
  })
  @IsString()
  @IsOptional()
  search?: string;

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

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'operationDate',
    enum: ['operationDate', 'createdAt', 'amount'],
  })
  @IsString()
  @IsOptional()
  sortBy?: 'operationDate' | 'createdAt' | 'amount' = 'operationDate';

  @ApiPropertyOptional({
    description: 'Sort order',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
