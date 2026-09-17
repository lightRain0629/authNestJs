import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CreateRecordDto } from './create-record.dto';

/**
 * Every field optional. The nullable ones are spelled out because clearing a
 * value and leaving it alone are different requests: `null` clears, omitting
 * keeps.
 */
export class UpdateRecordDto extends PartialType(CreateRecordDto) {
  @ApiPropertyOptional({
    description: 'Send null together with baseRate to clear the custom rate.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  declare baseCurrency?: string | null;

  @ApiPropertyOptional({
    description:
      'Send null together with baseCurrency to clear the custom rate.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d*\.?\d+$/, {
    message: 'Rate must be a positive decimal string',
  })
  declare baseRate?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to clear the note.',
    maxLength: 500,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  declare remark?: string | null;
}
