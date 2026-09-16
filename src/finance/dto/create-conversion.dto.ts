import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateConversionDto {
  @ApiProperty({
    description: 'Amount to convert from (as string decimal)',
    example: '100.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Amount must be a positive decimal string with up to 8 decimal places',
  })
  fromAmount: string;

  @ApiProperty({
    description: 'Source currency ISO code',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  fromCurrency: string;

  @ApiProperty({
    description: 'Target currency ISO code',
    example: 'EUR',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  toCurrency: string;

  @ApiProperty({
    description: 'Operation date for rate lookup (ISO 8601)',
    example: '2024-01-15T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  operationDate: string;

  @ApiPropertyOptional({
    description:
      'Account the money leaves. Its currency must equal fromCurrency.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  fromAccountId?: string;

  @ApiPropertyOptional({
    description:
      'Account the money lands in. Its currency must equal toCurrency.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  toAccountId?: string;

  @ApiPropertyOptional({
    description: 'Fee amount (as string decimal)',
    example: '5.00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Fee amount must be a positive decimal string with up to 8 decimal places',
  })
  feeAmount?: string;

  @ApiPropertyOptional({
    description: 'Fee currency ISO code',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  feeCurrency?: string;

  @ApiPropertyOptional({
    description: 'Optional remark/note',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;
}
