import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRateDto, ListRatesDto, LatestRateDto } from '../dto';
import { CurrencyRate, Prisma } from '@prisma/client';

export interface RateLookupResult {
  rate: CurrencyRate;
  effectiveRate: Prisma.Decimal;
  isInverse: boolean;
}

@Injectable()
export class RateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRateDto): Promise<CurrencyRate> {
    return this.prisma.currencyRate.create({
      data: {
        baseCurrency: dto.baseCurrency.toUpperCase(),
        quoteCurrency: dto.quoteCurrency.toUpperCase(),
        rate: new Prisma.Decimal(dto.rate),
        source: dto.source ?? null,
        effectiveAt: new Date(dto.effectiveAt),
      },
    });
  }

  async findAll(query: ListRatesDto): Promise<CurrencyRate[]> {
    const where: Prisma.CurrencyRateWhereInput = {
      ...(query.base ? { baseCurrency: query.base.toUpperCase() } : {}),
      ...(query.quote ? { quoteCurrency: query.quote.toUpperCase() } : {}),
      ...(query.from || query.to
        ? {
            effectiveAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.currencyRate.findMany({
      where,
      orderBy: { effectiveAt: 'desc' },
      take: 100,
    });
  }

  async findLatest(query: LatestRateDto): Promise<RateLookupResult> {
    const targetDate = query.asOf ? new Date(query.asOf) : new Date();
    return this.findRateForDate(
      query.base.toUpperCase(),
      query.quote.toUpperCase(),
      targetDate,
    );
  }

  async findRateForDate(
    fromCurrency: string,
    toCurrency: string,
    targetDate: Date,
  ): Promise<RateLookupResult> {
    const directRate = await this.prisma.currencyRate.findFirst({
      where: {
        baseCurrency: fromCurrency,
        quoteCurrency: toCurrency,
        effectiveAt: { lte: targetDate },
      },
      orderBy: { effectiveAt: 'desc' },
    });

    if (directRate) {
      return {
        rate: directRate,
        effectiveRate: directRate.rate,
        isInverse: false,
      };
    }

    const inverseRate = await this.prisma.currencyRate.findFirst({
      where: {
        baseCurrency: toCurrency,
        quoteCurrency: fromCurrency,
        effectiveAt: { lte: targetDate },
      },
      orderBy: { effectiveAt: 'desc' },
    });

    if (inverseRate) {
      const invertedRate = new Prisma.Decimal(1).div(inverseRate.rate);
      return {
        rate: inverseRate,
        effectiveRate: invertedRate,
        isInverse: true,
      };
    }

    throw new NotFoundException(
      `No FX rate found for ${fromCurrency}/${toCurrency} at ${targetDate.toISOString()}`,
    );
  }

  async findById(id: string): Promise<CurrencyRate> {
    const rate = await this.prisma.currencyRate.findUnique({
      where: { id },
    });

    if (!rate) {
      throw new NotFoundException('Rate not found');
    }

    return rate;
  }
}
