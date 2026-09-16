import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceAccountKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class ListAccountsDto {
  @ApiPropertyOptional({ enum: FinanceAccountKind })
  @IsEnum(FinanceAccountKind)
  @IsOptional()
  kind?: FinanceAccountKind;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeArchived?: boolean = false;
}
