import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SummaryDto } from '../dto';
import { Prisma } from '@prisma/client';
import { RateService } from './rate.service';
import { SummaryResponse } from '../responses';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateService: RateService,
  ) {}

  async getSummary(
    userId: string,
    query: SummaryDto,
  ): Promise<SummaryResponse> {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);

    const records = await this.prisma.financeRecord.groupBy({
      by: ['type', 'currency'],
      where: {
        userId,
        operationDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const income: Record<string, string> = {};
    const expense: Record<string, string> = {};

    for (const record of records) {
      const amount = record._sum.amount?.toString() ?? '0';
      if (record.type === 'INCOME') {
        income[record.currency] = amount;
      } else {
        expense[record.currency] = amount;
      }
    }

    const conversions = await this.prisma.currencyConversion.findMany({
      where: {
        userId,
        operationDate: {
          gte: fromDate,
          lte: toDate,
        },
        feeAmount: { not: null },
      },
      select: {
        feeAmount: true,
        feeCurrency: true,
      },
    });

    const conversionFees: Record<string, Prisma.Decimal> = {};
    for (const conv of conversions) {
      if (conv.feeAmount && conv.feeCurrency) {
        const current =
          conversionFees[conv.feeCurrency] ?? new Prisma.Decimal(0);
        conversionFees[conv.feeCurrency] = current.add(conv.feeAmount);
      }
    }

    const feesFormatted: Record<string, string> = {};
    for (const [currency, amount] of Object.entries(conversionFees)) {
      feesFormatted[currency] = amount.toString();
      expense[currency] = new Prisma.Decimal(expense[currency] ?? '0')
        .add(amount)
        .toString();
    }

    const response: Partial<SummaryResponse> = {
      income,
      expense,
      conversionFees:
        Object.keys(feesFormatted).length > 0 ? feesFormatted : undefined,
    };

    if (query.baseCurrency) {
      const baseCurrency = query.baseCurrency.toUpperCase();
      let totalIncome = new Prisma.Decimal(0);
      let totalExpense = new Prisma.Decimal(0);

      for (const [currency, amount] of Object.entries(income)) {
        const converted = await this.convertToBase(
          userId,
          new Prisma.Decimal(amount),
          currency,
          baseCurrency,
          toDate,
        );
        totalIncome = totalIncome.add(converted);
      }

      for (const [currency, amount] of Object.entries(expense)) {
        const converted = await this.convertToBase(
          userId,
          new Prisma.Decimal(amount),
          currency,
          baseCurrency,
          toDate,
        );
        totalExpense = totalExpense.add(converted);
      }

      response.incomeBaseCurrency = totalIncome.toFixed(2);
      response.expenseBaseCurrency = totalExpense.toFixed(2);
      response.netBaseCurrency = totalIncome.sub(totalExpense).toFixed(2);
    }

    return new SummaryResponse(response);
  }

  private async convertToBase(
    userId: string,
    amount: Prisma.Decimal,
    fromCurrency: string,
    baseCurrency: string,
    asOfDate: Date,
  ): Promise<Prisma.Decimal> {
    if (fromCurrency === baseCurrency) {
      return amount;
    }

    try {
      const rateLookup = await this.rateService.findRateForDate(
        userId,
        fromCurrency,
        baseCurrency,
        asOfDate,
      );
      return amount.mul(rateLookup.effectiveRate);
    } catch (error) {
      this.logger.warn(
        `No rate found for ${fromCurrency}/${baseCurrency}, returning 0 for conversion`,
      );
      return new Prisma.Decimal(0);
    }
  }
}
