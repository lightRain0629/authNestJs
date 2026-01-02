import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceRecord, FinanceRecordType, Prisma } from '@prisma/client';
import { Exclude, Transform } from 'class-transformer';
import { ArticleResponse } from './article.response';

type RecordWithArticle = FinanceRecord & {
  article?: { id: string; name: string; kind: string; color: string | null } | null;
};

export class RecordResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Exclude()
  userId: string;

  @ApiProperty({ enum: FinanceRecordType })
  type: FinanceRecordType;

  @ApiProperty({ description: 'Amount as string decimal' })
  @Transform(({ value }) => value?.toString() ?? null)
  amount: string;

  @ApiProperty({ description: 'Currency ISO code' })
  currency: string;

  @ApiPropertyOptional({ format: 'uuid' })
  articleId: string | null;

  @ApiPropertyOptional()
  remark: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  operationDate: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Article details if included' })
  article?: { id: string; name: string; kind: string; color: string | null } | null;

  constructor(record: RecordWithArticle) {
    this.id = record.id;
    this.userId = record.userId;
    this.type = record.type;
    this.amount = record.amount instanceof Prisma.Decimal
      ? record.amount.toString()
      : String(record.amount);
    this.currency = record.currency;
    this.articleId = record.articleId;
    this.remark = record.remark;
    this.operationDate = record.operationDate;
    this.createdAt = record.createdAt;
    this.updatedAt = record.updatedAt;
    this.article = record.article ?? null;
  }
}
