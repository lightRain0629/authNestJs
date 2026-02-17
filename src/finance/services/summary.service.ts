import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChartQueryDto, SummaryDto } from '../dto';
import { FinanceRecordType, Prisma } from '@prisma/client';
import { RateService } from './rate.service';
import { ChartResponse, SummaryResponse } from '../responses';

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

  async getExpenseChart(
    userId: string,
    query: ChartQueryDto,
  ): Promise<ChartResponse> {
    return this.getChart(userId, 'EXPENSE', query);
  }

  async getIncomeChart(
    userId: string,
    query: ChartQueryDto,
  ): Promise<ChartResponse> {
    return this.getChart(userId, 'INCOME', query);
  }

  private async getChart(
    userId: string,
    type: FinanceRecordType,
    query: ChartQueryDto,
  ): Promise<ChartResponse> {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);

    const grouped = await this.prisma.financeRecord.groupBy({
      by: ['articleId', 'currency'],
      where: {
        userId,
        type,
        operationDate: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
    });

    const articleIds = grouped
      .map((g) => g.articleId)
      .filter((id): id is string => id !== null);

    const articles =
      articleIds.length > 0
        ? await this.prisma.financeArticle.findMany({
            where: { id: { in: articleIds } },
            select: { id: true, name: true, color: true },
          })
        : [];

    const articleMap = new Map(articles.map((a) => [a.id, a]));

    const currencyTotals: Record<string, Prisma.Decimal> = {};
    for (const g of grouped) {
      const amount = g._sum.amount ?? new Prisma.Decimal(0);
      currencyTotals[g.currency] = (
        currencyTotals[g.currency] ?? new Prisma.Decimal(0)
      ).add(amount);
    }

    const items = grouped
      .map((g) => {
        const amount = g._sum.amount ?? new Prisma.Decimal(0);
        const article = g.articleId ? articleMap.get(g.articleId) : null;
        const grandTotal = currencyTotals[g.currency];
        const percentage = grandTotal.isZero()
          ? 0
          : parseFloat(amount.mul(100).div(grandTotal).toFixed(2));

        return {
          articleId: g.articleId,
          categoryName: article?.name ?? 'No Category',
          categoryColor: article?.color ?? '#B0BEC5',
          total: amount.toString(),
          currency: g.currency,
          percentage,
        };
      })
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    const total: Record<string, string> = {};
    for (const [currency, amount] of Object.entries(currencyTotals)) {
      total[currency] = amount.toString();
    }

    return new ChartResponse({ items, total });
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
