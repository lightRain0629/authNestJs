import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceArticleKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListArticlesDto {
  @ApiPropertyOptional({
    description: 'Filter by article kind',
    enum: FinanceArticleKind,
    example: 'EXPENSE',
  })
  @IsEnum(FinanceArticleKind)
  @IsOptional()
  kind?: FinanceArticleKind;

  @ApiPropertyOptional({
    description: 'Include archived articles',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeArchived?: boolean;
}
