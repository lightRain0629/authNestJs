import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class PlanProgressDto {
  @ApiPropertyOptional({
    description:
      'Window to measure. Defaults to the calendar month containing today.',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Report every plan in this currency instead of its own.',
  })
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/)
  @IsOptional()
  baseCurrency?: string;
}
