import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyConversion, Prisma } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class ConversionResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Exclude()
  userId: string;

  @ApiProperty({ description: 'From amount as string decimal' })
  fromAmount: string;

  @ApiProperty({ description: 'From currency ISO code' })
  fromCurrency: string;

  @ApiProperty({ description: 'To amount as string decimal' })
  toAmount: string;

  @ApiProperty({ description: 'To currency ISO code' })
  toCurrency: string;

  @ApiProperty({ description: 'Rate used as string decimal' })
  rateUsed: string;

  @ApiPropertyOptional({ format: 'uuid' })
  rateId: string | null;

  @ApiPropertyOptional({ description: 'Fee amount as string decimal' })
  feeAmount: string | null;

  @ApiPropertyOptional({ description: 'Fee currency ISO code' })
  feeCurrency: string | null;

  @ApiPropertyOptional()
  remark: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  operationDate: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(conversion: CurrencyConversion) {
    this.id = conversion.id;
    this.userId = conversion.userId;
    this.fromAmount = conversion.fromAmount instanceof Prisma.Decimal
      ? conversion.fromAmount.toString()
      : String(conversion.fromAmount);
    this.fromCurrency = conversion.fromCurrency;
    this.toAmount = conversion.toAmount instanceof Prisma.Decimal
      ? conversion.toAmount.toString()
      : String(conversion.toAmount);
    this.toCurrency = conversion.toCurrency;
    this.rateUsed = conversion.rateUsed instanceof Prisma.Decimal
      ? conversion.rateUsed.toString()
      : String(conversion.rateUsed);
    this.rateId = conversion.rateId;
    this.feeAmount = conversion.feeAmount instanceof Prisma.Decimal
      ? conversion.feeAmount.toString()
      : conversion.feeAmount ? String(conversion.feeAmount) : null;
    this.feeCurrency = conversion.feeCurrency;
    this.remark = conversion.remark;
    this.operationDate = conversion.operationDate;
    this.createdAt = conversion.createdAt;
    this.updatedAt = conversion.updatedAt;
  }
}
