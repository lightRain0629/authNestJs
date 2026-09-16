import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceRecordType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRecordDto {
  @ApiProperty({
    description: 'Record type (EXPENSE or INCOME)',
    enum: FinanceRecordType,
    example: 'EXPENSE',
  })
  @IsEnum(FinanceRecordType)
  @IsNotEmpty()
  type: FinanceRecordType;

  @ApiProperty({
    description: 'Amount as string decimal (positive)',
    example: '150.50',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Amount must be a positive decimal string with up to 8 decimal places',
  })
  amount: string;

  @ApiProperty({
    description: 'Currency or asset ticker (USD, TMT, BTC, USDT)',
    example: 'USD',
    maxLength: 10,
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Article (category) ID',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  articleId?: string;

  @ApiPropertyOptional({
    description:
      'Account this money moves through. Must match the account currency. ' +
      'Omit to leave the record unassigned (counts in reports, not in balances).',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Optional remark/note',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({
    description: 'Operation date (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  operationDate: string;
}
