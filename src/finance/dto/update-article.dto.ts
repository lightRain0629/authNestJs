import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateArticleDto } from './create-article.dto';

export class UpdateArticleDto extends PartialType(
  OmitType(CreateArticleDto, ['kind'] as const),
) {
  @ApiPropertyOptional({
    description: 'Archive status',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
