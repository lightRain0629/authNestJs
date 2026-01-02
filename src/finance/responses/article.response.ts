import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceArticle, FinanceArticleKind } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class ArticleResponse implements FinanceArticle {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Exclude()
  userId: string;

  @ApiProperty({ enum: FinanceArticleKind })
  kind: FinanceArticleKind;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  color: string | null;

  @ApiProperty({ default: false })
  isArchived: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(article: FinanceArticle) {
    Object.assign(this, article);
  }
}
