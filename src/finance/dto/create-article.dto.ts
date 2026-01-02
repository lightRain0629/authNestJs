import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceArticleKind } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({
    description: 'Article type (EXPENSE or INCOME)',
    enum: FinanceArticleKind,
    example: 'EXPENSE',
  })
  @IsEnum(FinanceArticleKind)
  @IsNotEmpty()
  kind: FinanceArticleKind;

  @ApiProperty({
    description: 'Article name (unique per user and kind)',
    minLength: 1,
    maxLength: 100,
    example: 'Food & Dining',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Color for UI display (hex or named color)',
    example: '#FF5733',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;
}
