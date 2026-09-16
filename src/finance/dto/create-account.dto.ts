import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinanceAccountKind,
  FinanceAccountValuationMode,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Assets and liabilities share one table; kind decides which side of net worth they land on. */
export class CreateAccountDto {
  @ApiProperty({
    description: 'Account name, unique per user',
    example: 'Halkbank card',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: FinanceAccountKind, example: 'BANK' })
  @IsEnum(FinanceAccountKind)
  kind: FinanceAccountKind;

  @ApiPropertyOptional({
    enum: FinanceAccountValuationMode,
    default: 'TRACKED',
    description:
      'TRACKED derives the balance from records and transfers; VALUED uses the latest manual valuation.',
  })
  @IsEnum(FinanceAccountValuationMode)
  @IsOptional()
  valuationMode?: FinanceAccountValuationMode;

  @ApiProperty({
    description: 'Currency or asset ticker (USD, TMT, BTC, USDT)',
    example: 'TMT',
  })
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message: 'Currency must be 2-10 uppercase letters or digits',
  })
  currency: string;

  @ApiPropertyOptional({
    description:
      'Balance held before this app started tracking. Negative for money owed.',
    example: '1500.00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^-?\d+(\.\d{1,8})?$/, { message: 'Invalid opening balance' })
  openingBalance?: string;

  @ApiPropertyOptional({ description: 'Date the opening balance refers to' })
  @IsDateString()
  @IsOptional()
  openingDate?: string;

  @ApiPropertyOptional({ example: 'Halkbank' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  institution?: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: 'wallet' })
  @IsString()
  @IsOptional()
  @MaxLength(40)
  icon?: string;

  @ApiPropertyOptional({
    description:
      'Who you owe or who owes you. For LOAN, CREDIT_CARD, RECEIVABLE.',
    example: 'Rustam',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  counterparty?: string;

  @ApiPropertyOptional({ description: 'Credit limit for CREDIT_CARD accounts' })
  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,8})?$/, { message: 'Invalid credit limit' })
  creditLimit?: string;

  @ApiPropertyOptional({
    description: 'Annual interest rate in percent',
    example: '12.5',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'Invalid interest rate' })
  interestRate?: string;

  @ApiPropertyOptional({ description: 'Repayment due date for debts' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  excludeFromNetWorth?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
