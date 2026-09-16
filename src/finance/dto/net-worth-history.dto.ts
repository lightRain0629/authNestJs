import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export type NetWorthInterval = 'day' | 'week' | 'month';

export class NetWorthHistoryDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month' })
  @IsIn(['day', 'week', 'month'])
  @IsOptional()
  interval?: NetWorthInterval = 'month';

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{2,10}$/, { message: 'Invalid base currency' })
  baseCurrency?: string;
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
