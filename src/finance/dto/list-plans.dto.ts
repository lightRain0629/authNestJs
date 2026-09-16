import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinancePlanKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class ListPlansDto {
  @ApiPropertyOptional({ enum: FinancePlanKind })
  @IsEnum(FinancePlanKind)
  @IsOptional()
  kind?: FinancePlanKind;

  @ApiPropertyOptional({ default: false })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;
}
