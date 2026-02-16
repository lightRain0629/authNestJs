import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'Amount must be a positive decimal string with up to 4 decimal places',
  })
  fromAmount: string;

  @ApiProperty({
    description: 'Source currency ISO code',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  fromCurrency: string;

  @ApiProperty({
    description: 'Target currency ISO code',
    example: 'EUR',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
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
    description: 'Fee amount (as string decimal)',
    example: '5.00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'Fee amount must be a positive decimal string with up to 4 decimal places',
  })
  feeAmount?: string;

  @ApiPropertyOptional({
    description: 'Fee currency ISO code',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
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
