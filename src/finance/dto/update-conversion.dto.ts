import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { CreateConversionDto } from './create-conversion.dto';

/**
 * Every field optional, currencies and accounts included: a transfer typed
 * against the wrong account or at the wrong rate is exactly what this corrects.
 */
export class UpdateConversionDto extends PartialType(CreateConversionDto) {
  @ApiPropertyOptional({
    description:
      'A rate to re-book at. Omit to keep whatever the transfer already ' +
      'booked at, so fixing a remark never silently re-rates it. Send null ' +
      'to drop a custom rate and go back to the rate table.',
    example: '19.50',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d*\.?\d+$/, {
    message: 'Rate must be a positive decimal string',
  })
  declare rate?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to clear the fee.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message:
      'Fee amount must be a positive decimal string with up to 8 decimal places',
  })
  declare feeAmount?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to clear the fee currency.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  declare feeCurrency?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to clear the note.',
    maxLength: 500,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  declare remark?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to unlink the source account.',
    format: 'uuid',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  declare fromAccountId?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to unlink the destination account.',
    format: 'uuid',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  declare toAccountId?: string | null;
}
