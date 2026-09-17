import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SummaryService } from './summary.service';
import { RateService } from './rate.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = () => ({
  financeRecord: { groupBy: jest.fn(), findMany: jest.fn() },
  financeArticle: { findMany: jest.fn() },
  currencyConversion: { findMany: jest.fn() },
});

const mockRateService = () => ({ findRateForDate: jest.fn() });

const dec = (v: string) => new Prisma.Decimal(v);

describe('SummaryService', () => {
  let service: SummaryService;
  let prisma: ReturnType<typeof mockPrisma>;
  let rateService: ReturnType<typeof mockRateService>;

  const userId = 'user-1';
  const range = { from: '2024-01-01', to: '2024-01-31' };

  beforeEach(async () => {
    prisma = mockPrisma();
    rateService = mockRateService();
    prisma.financeArticle.findMany.mockResolvedValue([]);
    prisma.currencyConversion.findMany.mockResolvedValue([]);
    prisma.financeRecord.findMany.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SummaryService,
        { provide: PrismaService, useValue: prisma },
        { provide: RateService, useValue: rateService },
      ],
    }).compile();

    service = moduleRef.get(SummaryService);
  });

  afterEach(() => jest.clearAllMocks());

  /** The official rate, which a custom rate is supposed to beat. */
  const officialRate = (rate: string) =>
    rateService.findRateForDate.mockResolvedValue({
      rate: { id: 'rate-1' },
      effectiveRate: dec(rate),
      isInverse: false,
    });

  describe('getSummary', () => {
    it('converts at a record own rate instead of the rate table', async () => {
      officialRate('3.5');
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          type: 'EXPENSE',
          currency: 'USD',
          baseCurrency: 'TMT',
          baseRate: dec('19.5'),
          _sum: { amount: dec('100') },
        },
      ]);

      const result = await service.getSummary(userId, {
        ...range,
        baseCurrency: 'TMT',
      });

      expect(result.expenseBaseCurrency).toBe('1950.00');
      expect(rateService.findRateForDate).not.toHaveBeenCalled();
    });

    it('falls back to the table when the report asks for another base', async () => {
      officialRate('0.92');
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          type: 'EXPENSE',
          currency: 'USD',
          baseCurrency: 'TMT',
          baseRate: dec('19.5'),
          _sum: { amount: dec('100') },
        },
      ]);

      const result = await service.getSummary(userId, {
        ...range,
        baseCurrency: 'EUR',
      });

      // The TMT rate means nothing in a EUR report, so it must not apply.
      expect(result.expenseBaseCurrency).toBe('92.00');
    });

    it('sums rows that the override splits apart, in raw totals', async () => {
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          type: 'EXPENSE',
          currency: 'USD',
          baseCurrency: 'TMT',
          baseRate: dec('19.5'),
          _sum: { amount: dec('100') },
        },
        {
          type: 'EXPENSE',
          currency: 'USD',
          baseCurrency: null,
          baseRate: null,
          _sum: { amount: dec('40') },
        },
      ]);

      const result = await service.getSummary(userId, range);

      // One currency, one figure — not the last group silently winning.
      expect(result.expense).toEqual({ USD: '140' });
    });

    it('still counts conversion fees in the base total', async () => {
      officialRate('2');
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          type: 'EXPENSE',
          currency: 'TMT',
          baseCurrency: null,
          baseRate: null,
          _sum: { amount: dec('10') },
        },
      ]);
      prisma.currencyConversion.findMany.mockResolvedValue([
        { feeAmount: dec('3'), feeCurrency: 'USD' },
      ]);

      const result = await service.getSummary(userId, {
        ...range,
        baseCurrency: 'TMT',
      });

      // 10 TMT of records + 3 USD of fees at 2 = 16.
      expect(result.expenseBaseCurrency).toBe('16.00');
    });
  });

  describe('getExpenseChart', () => {
    it('folds rows the override split back into one slice per category', async () => {
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          articleId: 'art-1',
          currency: 'USD',
          baseCurrency: 'TMT',
          baseRate: dec('19.5'),
          _sum: { amount: dec('60') },
        },
        {
          articleId: 'art-1',
          currency: 'USD',
          baseCurrency: null,
          baseRate: null,
          _sum: { amount: dec('40') },
        },
      ]);
      prisma.financeArticle.findMany.mockResolvedValue([
        { id: 'art-1', name: 'Groceries', color: '#fff' },
      ]);

      const result = await service.getExpenseChart(userId, range);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        articleId: 'art-1',
        categoryName: 'Groceries',
        total: '100',
        currency: 'USD',
        percentage: 100,
      });
    });

    it('keeps separate currencies as separate slices', async () => {
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          articleId: 'art-1',
          currency: 'USD',
          baseCurrency: null,
          baseRate: null,
          _sum: { amount: dec('60') },
        },
        {
          articleId: 'art-1',
          currency: 'TMT',
          baseCurrency: null,
          baseRate: null,
          _sum: { amount: dec('40') },
        },
      ]);
      prisma.financeArticle.findMany.mockResolvedValue([
        { id: 'art-1', name: 'Groceries', color: '#fff' },
      ]);

      const result = await service.getExpenseChart(userId, range);

      expect(result.items).toHaveLength(2);
      expect(result.total).toEqual({ USD: '60', TMT: '40' });
    });

    it('applies a record own rate when charting in that base currency', async () => {
      officialRate('3.5');
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          articleId: null,
          currency: 'USD',
          baseCurrency: 'TMT',
          baseRate: dec('19.5'),
          _sum: { amount: dec('100') },
        },
      ]);

      const result = await service.getExpenseChart(userId, {
        ...range,
        baseCurrency: 'TMT',
      });

      expect(result.items[0].total).toBe('1950.00');
    });
  });

  describe('getCashflow', () => {
    it('uses a record own rate and never reports it as a missing rate', async () => {
      rateService.findRateForDate.mockRejectedValue(
        new NotFoundException('no rate'),
      );
      prisma.financeRecord.findMany.mockResolvedValue([
        {
          type: 'EXPENSE',
          amount: dec('100'),
          currency: 'USD',
          baseCurrency: 'TMT',
          baseRate: dec('19.5'),
          operationDate: new Date('2024-01-15'),
          article: null,
          account: null,
        },
      ]);

      const result = await service.getCashflow(userId, {
        ...range,
        baseCurrency: 'TMT',
      });

      expect(result.totalExpense).toBe('1950.00');
      expect(result.missingRates).toEqual([]);
    });

    it('reports a missing rate for a record with no override', async () => {
      rateService.findRateForDate.mockRejectedValue(
        new NotFoundException('no rate'),
      );
      prisma.financeRecord.findMany.mockResolvedValue([
        {
          type: 'EXPENSE',
          amount: dec('100'),
          currency: 'USD',
          baseCurrency: null,
          baseRate: null,
          operationDate: new Date('2024-01-15'),
          article: null,
          account: null,
        },
      ]);

      const result = await service.getCashflow(userId, {
        ...range,
        baseCurrency: 'TMT',
      });

      expect(result.totalExpense).toBe('0.00');
      expect(result.missingRates).toEqual([{ from: 'USD', to: 'TMT' }]);
    });
  });
});
