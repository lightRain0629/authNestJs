import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConversionDto, ListConversionsDto } from '../dto';
import { CurrencyConversion, Prisma } from '@prisma/client';
import { RateService } from './rate.service';

@Injectable()
export class ConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateService: RateService,
  ) {}

  async create(
    userId: string,
    dto: CreateConversionDto,
  ): Promise<CurrencyConversion> {
    const fromCurrency = dto.fromCurrency.toUpperCase();
    const toCurrency = dto.toCurrency.toUpperCase();
    const operationDate = new Date(dto.operationDate);

    let rateLookup;
    try {
      rateLookup = await this.rateService.findRateForDate(
        userId,
        fromCurrency,
        toCurrency,
        operationDate,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnprocessableEntityException(
          `No FX rate found for ${fromCurrency}/${toCurrency} at ${operationDate.toISOString()}`,
        );
      }
      throw error;
    }

    const fromAmount = new Prisma.Decimal(dto.fromAmount);
    const toAmount = fromAmount.mul(rateLookup.effectiveRate);

    return this.prisma.currencyConversion.create({
      data: {
        userId,
        fromAmount,
        fromCurrency,
        toAmount,
        toCurrency,
        rateUsed: rateLookup.effectiveRate,
        rateId: rateLookup.rate.id,
        feeAmount: dto.feeAmount ? new Prisma.Decimal(dto.feeAmount) : null,
        feeCurrency: dto.feeCurrency?.toUpperCase() ?? null,
        remark: dto.remark ?? null,
        operationDate,
      },
    });
  }

  async findAll(
    userId: string,
    query: ListConversionsDto,
  ): Promise<{ items: CurrencyConversion[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CurrencyConversionWhereInput = {
      userId,
      ...(query.fromCurrency
        ? { fromCurrency: query.fromCurrency.toUpperCase() }
        : {}),
      ...(query.toCurrency
        ? { toCurrency: query.toCurrency.toUpperCase() }
        : {}),
      ...(query.from || query.to
        ? {
            operationDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.currencyConversion.findMany({
        where,
        orderBy: [{ operationDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.currencyConversion.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string, userId: string): Promise<CurrencyConversion> {
    const conversion = await this.prisma.currencyConversion.findFirst({
      where: { id, userId },
    });

    if (!conversion) {
      throw new NotFoundException('Conversion not found');
    }

    return conversion;
  }

  async remove(id: string, userId: string): Promise<CurrencyConversion> {
    await this.findOne(id, userId);

    return this.prisma.currencyConversion.delete({
      where: { id },
    });
  }
}
