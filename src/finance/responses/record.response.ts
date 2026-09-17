import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceRecord, FinanceRecordType, Prisma } from '@prisma/client';
import { Exclude, Transform } from 'class-transformer';

type RecordWithArticle = FinanceRecord & {
  article?: {
    id: string;
    name: string;
    kind: string;
    color: string | null;
  } | null;
  account?: {
    id: string;
    name: string;
    kind: string;
    currency: string;
    color: string | null;
  } | null;
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

  @ApiPropertyOptional({
    description: "Currency this record's custom rate converts into",
  })
  baseCurrency: string | null;

  @ApiPropertyOptional({
    description:
      'Custom rate into baseCurrency, used instead of the rate table when a ' +
      'report asks for exactly that base currency',
  })
  baseRate: string | null;

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

  @ApiPropertyOptional({ format: 'uuid' })
  accountId: string | null;

  @ApiPropertyOptional({ description: 'Article details if included' })
  article?: {
    id: string;
    name: string;
    kind: string;
    color: string | null;
  } | null;

  @ApiPropertyOptional({ description: 'Account details if included' })
  account?: {
    id: string;
    name: string;
    kind: string;
    currency: string;
    color: string | null;
  } | null;

  constructor(record: RecordWithArticle) {
    this.id = record.id;
    this.userId = record.userId;
    this.type = record.type;
    this.amount =
      record.amount instanceof Prisma.Decimal
        ? record.amount.toString()
        : String(record.amount);
    this.currency = record.currency;
    this.baseCurrency = record.baseCurrency;
    this.baseRate = record.baseRate ? record.baseRate.toString() : null;
    this.articleId = record.articleId;
    this.accountId = record.accountId;
    this.remark = record.remark;
    this.operationDate = record.operationDate;
    this.createdAt = record.createdAt;
    this.updatedAt = record.updatedAt;
    this.article = record.article ?? null;
    this.account = record.account ?? null;
  }
}
