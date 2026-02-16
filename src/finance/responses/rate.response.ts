import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyRate, Prisma } from '@prisma/client';

export class RateResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Base currency ISO code' })
  baseCurrency: string;

  @ApiProperty({ description: 'Quote currency ISO code' })
  quoteCurrency: string;

  @ApiProperty({ description: 'Exchange rate as string decimal' })
  rate: string;

  @ApiPropertyOptional({ description: 'Rate source' })
  source: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(rate: CurrencyRate) {
    this.id = rate.id;
    this.baseCurrency = rate.baseCurrency;
    this.quoteCurrency = rate.quoteCurrency;
    this.rate =
      rate.rate instanceof Prisma.Decimal
        ? rate.rate.toString()
        : String(rate.rate);
    this.source = rate.source;
    this.effectiveAt = rate.effectiveAt;
    this.createdAt = rate.createdAt;
    this.updatedAt = rate.updatedAt;
  }
}
