import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
}
