import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class BalancesDto {
  @ApiPropertyOptional({
    description: 'Balances as of this moment. Defaults to now.',
  })
  @IsDateString()
  @IsOptional()
  asOf?: string;

  @ApiPropertyOptional({
    description:
      'Convert every balance into this currency for a comparable total',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{2,10}$/, { message: 'Invalid base currency' })
  baseCurrency?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeArchived?: boolean = false;
  @ApiPropertyOptional({
    default: false,
    description:
      'Leave money you have lent out of the totals, showing only what is actually within reach.',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  excludeReceivables?: boolean = false;
}
