import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** INCOME and EXPENSE are records; TRANSFER is a currency conversion. */
export const TRANSACTION_KINDS = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export class ListTransactionsDto {
  @ApiPropertyOptional({
    description:
      'Filter to one kind. Omit for the full timeline of records and transfers.',
    enum: TRANSACTION_KINDS,
  })
  @IsIn(TRANSACTION_KINDS as unknown as string[])
  @IsOptional()
  kind?: TransactionKind;

  @ApiPropertyOptional({
    description: 'Filter by currency. Matches either leg of a transfer.',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filter by article ID. Excludes transfers, which have none.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  articleId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by account ID. Matches either side of a transfer, so an ' +
      "account's history includes money moved in and out of it.",
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  accountId?: string;

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
    description:
      'Search text in remark and article name; also parses as an amount ' +
      '("1200", ">500", "100-250").',
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
    description: 'Sort order by operation date',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
