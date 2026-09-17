import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CashflowDto,
  CashflowInterval,
  ChartQueryDto,
  SummaryDto,
} from '../dto';
import { FinanceRecordType, Prisma } from '@prisma/client';
import { RateService } from './rate.service';
import {
  CashflowPoint,
  CashflowResponse,
  ChartResponse,
  FlowLeg,
  MissingRate,
  SummaryResponse,
} from '../responses';

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

    // Records carrying their own rate group separately, because a group total
    // can only be converted once and those convert at a different rate.
    const records = await this.prisma.financeRecord.groupBy({
      by: ['type', 'currency', 'baseCurrency', 'baseRate'],
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
      const amount = record._sum.amount ?? new Prisma.Decimal(0);
      const bucket = record.type === 'INCOME' ? income : expense;
      bucket[record.currency] = new Prisma.Decimal(bucket[record.currency] ?? 0)
        .add(amount)
        .toString();
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

      for (const record of records) {
        const converted = await this.convertRecordToBase(
          userId,
          record._sum.amount ?? new Prisma.Decimal(0),
          record.currency,
          record.baseCurrency,
          record.baseRate,
          baseCurrency,
          toDate,
        );
        if (record.type === 'INCOME') {
          totalIncome = totalIncome.add(converted);
        } else {
          totalExpense = totalExpense.add(converted);
        }
      }

      // Fees belong to a conversion, not a record, so they never carry an
      // override and always convert at the table rate.
      for (const [currency, amount] of Object.entries(conversionFees)) {
        totalExpense = totalExpense.add(
          await this.convertToBase(
            userId,
            amount,
            currency,
            baseCurrency,
            toDate,
          ),
        );
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
    const baseCurrency = query.baseCurrency?.toUpperCase();

    const grouped = await this.prisma.financeRecord.groupBy({
      by: ['articleId', 'currency', 'baseCurrency', 'baseRate'],
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

    if (baseCurrency) {
      // Convert all amounts to base currency, merge same articleId
      const mergedMap = new Map<
        string | null,
        { amount: Prisma.Decimal; article: (typeof articles)[0] | null }
      >();

      for (const g of grouped) {
        const raw = g._sum.amount ?? new Prisma.Decimal(0);
        const converted = await this.convertRecordToBase(
          userId,
          raw,
          g.currency,
          g.baseCurrency,
          g.baseRate,
          baseCurrency,
          toDate,
        );
        const existing = mergedMap.get(g.articleId);
        const article = g.articleId
          ? articleMap.get(g.articleId) ?? null
          : null;
        if (existing) {
          existing.amount = existing.amount.add(converted);
        } else {
          mergedMap.set(g.articleId, { amount: converted, article });
        }
      }

      let grandTotal = new Prisma.Decimal(0);
      for (const { amount } of mergedMap.values()) {
        grandTotal = grandTotal.add(amount);
      }

      const items = Array.from(mergedMap.entries())
        .map(([articleId, { amount, article }]) => ({
          articleId,
          categoryName: article?.name ?? 'No Category',
          categoryColor: article?.color ?? '#B0BEC5',
          total: amount.toFixed(2),
          currency: baseCurrency,
          percentage: grandTotal.isZero()
            ? 0
            : parseFloat(amount.mul(100).div(grandTotal).toFixed(2)),
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

      return new ChartResponse({
        items,
        total: { [baseCurrency]: grandTotal.toFixed(2) },
      });
    }

    // No base currency — keep amounts in original currencies
    const currencyTotals: Record<string, Prisma.Decimal> = {};
    for (const g of grouped) {
      const amount = g._sum.amount ?? new Prisma.Decimal(0);
      currencyTotals[g.currency] = (
        currencyTotals[g.currency] ?? new Prisma.Decimal(0)
      ).add(amount);
    }

    // Grouping by the rate override splits one category across several rows,
    // so they are folded back together — a chart slice is per category and
    // currency, not per rate the records happened to be booked at.
    const byCategory = new Map<
      string,
      { articleId: string | null; currency: string; amount: Prisma.Decimal }
    >();
    for (const g of grouped) {
      const key = `${g.articleId ?? ''}|${g.currency}`;
      const existing = byCategory.get(key);
      const amount = g._sum.amount ?? new Prisma.Decimal(0);
      if (existing) {
        existing.amount = existing.amount.add(amount);
      } else {
        byCategory.set(key, {
          articleId: g.articleId,
          currency: g.currency,
          amount,
        });
      }
    }

    const items = Array.from(byCategory.values())
      .map(({ articleId, currency, amount }) => {
        const article = articleId ? articleMap.get(articleId) : null;
        const grandTotal = currencyTotals[currency];
        const percentage = grandTotal.isZero()
          ? 0
          : parseFloat(amount.mul(100).div(grandTotal).toFixed(2));

        return {
          articleId,
          categoryName: article?.name ?? 'No Category',
          categoryColor: article?.color ?? '#B0BEC5',
          total: amount.toString(),
          currency,
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

  /**
   * The money-flow view: income and expense per period, plus where the money
   * came from and where it went, all in one currency so the sides compare.
   */
  async getCashflow(
    userId: string,
    query: CashflowDto,
  ): Promise<CashflowResponse> {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    const interval = query.interval ?? 'month';
    const baseCurrency = query.baseCurrency?.toUpperCase() ?? 'USD';

    const missing = new Map<string, MissingRate>();
    const rateCache = new Map<string, Prisma.Decimal | null>();

    const convert = async (
      amount: Prisma.Decimal,
      currency: string,
      overrideBase: string | null = null,
      overrideRate: Prisma.Decimal | null = null,
    ): Promise<Prisma.Decimal | null> => {
      // A rate the user typed for this record wins, and can never be missing.
      if (overrideRate && overrideBase === baseCurrency) {
        return amount.mul(overrideRate);
      }
      if (currency === baseCurrency) return amount;
      const key = currency;
      if (!rateCache.has(key)) {
        try {
          const lookup = await this.rateService.findRateForDate(
            userId,
            currency,
            baseCurrency,
            toDate,
          );
          rateCache.set(key, new Prisma.Decimal(lookup.effectiveRate));
        } catch {
          rateCache.set(key, null);
          missing.set(key, { from: currency, to: baseCurrency });
        }
      }
      const rate = rateCache.get(key) ?? null;
      return rate === null ? null : amount.mul(rate);
    };

    const records = await this.prisma.financeRecord.findMany({
      where: {
        userId,
        operationDate: { gte: fromDate, lte: toDate },
      },
      select: {
        type: true,
        amount: true,
        currency: true,
        baseCurrency: true,
        baseRate: true,
        operationDate: true,
        article: { select: { id: true, name: true, color: true } },
        account: { select: { id: true, name: true, color: true, kind: true } },
      },
    });

    const buckets = new Map<
      string,
      { date: Date; income: Prisma.Decimal; expense: Prisma.Decimal }
    >();
    const incomeByCategory = new Map<
      string,
      FlowLeg & { raw: Prisma.Decimal }
    >();
    const expenseByCategory = new Map<
      string,
      FlowLeg & { raw: Prisma.Decimal }
    >();
    const expenseByAccount = new Map<
      string,
      FlowLeg & { raw: Prisma.Decimal }
    >();

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    const bump = (
      map: Map<string, FlowLeg & { raw: Prisma.Decimal }>,
      id: string | null,
      name: string,
      color: string,
      amount: Prisma.Decimal,
    ) => {
      const key = id ?? `~${name}`;
      const existing = map.get(key);
      if (existing) {
        existing.raw = existing.raw.add(amount);
      } else {
        map.set(key, {
          id,
          name,
          color,
          raw: amount,
          total: '0',
          percentage: 0,
        });
      }
    };

    for (const record of records) {
      const converted = await convert(
        record.amount,
        record.currency,
        record.baseCurrency,
        record.baseRate,
      );
      if (converted === null) continue;

      const bucketKey = this.bucketKey(record.operationDate, interval);
      const bucket = buckets.get(bucketKey) ?? {
        date: this.bucketStart(record.operationDate, interval),
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
      };

      if (record.type === 'INCOME') {
        bucket.income = bucket.income.add(converted);
        totalIncome = totalIncome.add(converted);
        bump(
          incomeByCategory,
          record.article?.id ?? null,
          record.article?.name ?? 'Uncategorized',
          record.article?.color ?? '#64748B',
          converted,
        );
      } else {
        bucket.expense = bucket.expense.add(converted);
        totalExpense = totalExpense.add(converted);
        bump(
          expenseByCategory,
          record.article?.id ?? null,
          record.article?.name ?? 'Uncategorized',
          record.article?.color ?? '#64748B',
          converted,
        );
        bump(
          expenseByAccount,
          record.account?.id ?? null,
          record.account?.name ?? 'Unassigned',
          record.account?.color ?? '#64748B',
          converted,
        );
      }

      buckets.set(bucketKey, bucket);
    }

    const points: CashflowPoint[] = Array.from(buckets.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((bucket) => ({
        date: bucket.date.toISOString(),
        label: this.bucketLabel(bucket.date, interval),
        income: bucket.income.toFixed(2),
        expense: bucket.expense.toFixed(2),
        net: bucket.income.sub(bucket.expense).toFixed(2),
      }));

    const finalize = (
      map: Map<string, FlowLeg & { raw: Prisma.Decimal }>,
      total: Prisma.Decimal,
    ): FlowLeg[] =>
      Array.from(map.values())
        .map(({ raw, ...leg }) => ({
          ...leg,
          total: raw.toFixed(2),
          percentage: total.isZero()
            ? 0
            : parseFloat(raw.mul(100).div(total).toFixed(2)),
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    const netFlow = totalIncome.sub(totalExpense);

    return new CashflowResponse({
      points,
      baseCurrency,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netFlow: netFlow.toFixed(2),
      savingsRate: totalIncome.isZero()
        ? null
        : parseFloat(netFlow.mul(100).div(totalIncome).toFixed(2)),
      averageExpense:
        points.length === 0
          ? '0.00'
          : totalExpense.div(points.length).toFixed(2),
      incomeByCategory: finalize(incomeByCategory, totalIncome),
      expenseByCategory: finalize(expenseByCategory, totalExpense),
      expenseByAccount: finalize(expenseByAccount, totalExpense),
      missingRates: Array.from(missing.values()),
    });
  }

  private bucketStart(date: Date, interval: CashflowInterval): Date {
    if (interval === 'day') {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    if (interval === 'week') {
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      start.setDate(start.getDate() - start.getDay());
      return start;
    }
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private bucketKey(date: Date, interval: CashflowInterval): string {
    return this.bucketStart(date, interval).toISOString();
  }

  private bucketLabel(date: Date, interval: CashflowInterval): string {
    if (interval === 'month') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * A record booked at a rate the user typed converts at that rate — but only
   * into the currency they typed it against. Asked for any other base, it falls
   * back to the rate table rather than applying a rate that means nothing there.
   */
  private async convertRecordToBase(
    userId: string,
    amount: Prisma.Decimal,
    fromCurrency: string,
    overrideBase: string | null,
    overrideRate: Prisma.Decimal | null,
    baseCurrency: string,
    asOfDate: Date,
  ): Promise<Prisma.Decimal> {
    if (overrideRate && overrideBase === baseCurrency) {
      return amount.mul(overrideRate);
    }
    return this.convertToBase(
      userId,
      amount,
      fromCurrency,
      baseCurrency,
      asOfDate,
    );
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
