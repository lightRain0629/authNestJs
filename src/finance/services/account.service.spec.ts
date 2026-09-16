import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountService } from './account.service';
import { RateService } from './rate.service';
import { PrismaService } from '../../prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const mockPrisma = () => ({
  financeAccount: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  financeRecord: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  currencyConversion: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  financeAccountValuation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockRateService = () => ({
  findRateForDate: jest.fn(),
  findNearestRateForDate: jest.fn(),
});

const account = (over: Record<string, unknown> = {}) => ({
  id: 'acc-1',
  userId: 'user-1',
  name: 'Cash',
  kind: 'CASH',
  valuationMode: 'TRACKED',
  currency: 'TMT',
  openingBalance: D(0),
  openingDate: new Date('2026-01-01'),
  institution: null,
  color: null,
  icon: null,
  counterparty: null,
  creditLimit: null,
  interestRate: null,
  dueDate: null,
  isArchived: false,
  excludeFromNetWorth: false,
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...over,
});

describe('AccountService', () => {
  let service: AccountService;
  let prisma: ReturnType<typeof mockPrisma>;
  let rateService: ReturnType<typeof mockRateService>;

  const userId = 'user-1';
  const asOf = '2026-06-30T00:00:00.000Z';

  beforeEach(async () => {
    prisma = mockPrisma();
    rateService = mockRateService();
    prisma.$transaction.mockImplementation(
      async (actions: Promise<unknown>[]) => Promise.all(actions),
    );
    prisma.financeRecord.groupBy.mockResolvedValue([]);
    prisma.currencyConversion.groupBy.mockResolvedValue([]);
    prisma.currencyConversion.findMany.mockResolvedValue([]);
    prisma.financeRecord.findMany.mockResolvedValue([]);
    prisma.financeAccountValuation.findMany.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: RateService, useValue: rateService },
      ],
    }).compile();

    service = moduleRef.get(AccountService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getBalances', () => {
    it('folds opening balance, income, expense and transfers into one balance', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({ openingBalance: D(100) }),
      ]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { accountId: 'acc-1', type: 'INCOME', _sum: { amount: D(500) } },
        { accountId: 'acc-1', type: 'EXPENSE', _sum: { amount: D(120) } },
      ]);
      prisma.currencyConversion.groupBy
        .mockResolvedValueOnce([
          { fromAccountId: 'acc-1', _sum: { fromAmount: D(80) } },
        ])
        .mockResolvedValueOnce([
          { toAccountId: 'acc-1', _sum: { toAmount: D(30) } },
        ]);

      const result = await service.getBalances(userId, { asOf });

      // 100 + 500 - 120 - 80 + 30
      expect(result.accounts[0].balance).toBe('430');
    });

    it('deducts a transfer fee only when it is in the source account currency', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([account()]);
      prisma.currencyConversion.findMany.mockResolvedValue([
        { fromAccountId: 'acc-1', feeAmount: D(5), feeCurrency: 'TMT' },
        { fromAccountId: 'acc-1', feeAmount: D(9), feeCurrency: 'USD' },
      ]);

      const result = await service.getBalances(userId, { asOf });

      expect(result.accounts[0].balance).toBe('-5');
    });

    it('reports a loan as a positive liability and subtracts it from net worth', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({
          id: 'acc-1',
          name: 'Bank',
          kind: 'BANK',
          openingBalance: D(1000),
        }),
        account({
          id: 'acc-2',
          name: 'Car loan',
          kind: 'LOAN',
          openingBalance: D(-400),
        }),
      ]);
      rateService.findNearestRateForDate.mockResolvedValue({
        rate: { id: 'r' },
        effectiveRate: D(1),
        isInverse: false,
      });

      const result = await service.getBalances(userId, {
        asOf,
        baseCurrency: 'TMT',
      });

      expect(result.totalAssets).toBe('1000.00');
      expect(result.totalLiabilities).toBe('400.00');
      expect(result.netWorth).toBe('600.00');
    });

    it('takes the latest valuation for a VALUED account and ignores records', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({
          kind: 'PROPERTY',
          valuationMode: 'VALUED',
          openingBalance: D(200000),
        }),
      ]);
      prisma.financeAccountValuation.findMany.mockResolvedValue([
        {
          accountId: 'acc-1',
          value: D(250000),
          valuedAt: new Date('2026-05-01'),
        },
        {
          accountId: 'acc-1',
          value: D(210000),
          valuedAt: new Date('2026-02-01'),
        },
      ]);

      const result = await service.getBalances(userId, { asOf });

      expect(result.accounts[0].balance).toBe('250000');
      expect(prisma.financeRecord.groupBy).not.toHaveBeenCalled();
    });

    it('flags a missing rate instead of silently counting the balance as zero', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({ currency: 'BTC', openingBalance: D('0.5') }),
      ]);
      rateService.findNearestRateForDate.mockRejectedValue(
        new NotFoundException(),
      );

      const result = await service.getBalances(userId, {
        asOf,
        baseCurrency: 'USD',
      });

      expect(result.accounts[0].rateMissing).toBe(true);
      expect(result.accounts[0].balanceInBase).toBeNull();
      expect(result.missingRates).toEqual([{ from: 'BTC', to: 'USD' }]);
      expect(result.totalAssets).toBe('0.00');
    });

    it('excludes an account marked excludeFromNetWorth from the totals but still lists it', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({ openingBalance: D(700), excludeFromNetWorth: true }),
      ]);
      rateService.findNearestRateForDate.mockResolvedValue({
        rate: { id: 'r' },
        effectiveRate: D(1),
        isInverse: false,
      });

      const result = await service.getBalances(userId, {
        asOf,
        baseCurrency: 'TMT',
      });

      expect(result.accounts).toHaveLength(1);
      expect(result.netWorth).toBe('0.00');
    });

    it('treats an account opened after asOf as not yet existing', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({
          openingBalance: D(900),
          openingDate: new Date('2026-12-01'),
        }),
      ]);

      const result = await service.getBalances(userId, { asOf });

      expect(result.accounts[0].balance).toBe('0');
    });
  });

  describe('assertAccountUsable', () => {
    it('rejects a record whose currency differs from the account', async () => {
      prisma.financeAccount.findFirst.mockResolvedValue(account());

      await expect(
        service.assertAccountUsable('acc-1', userId, 'USD'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects entries against a valuation-based account', async () => {
      prisma.financeAccount.findFirst.mockResolvedValue(
        account({ valuationMode: 'VALUED' }),
      );

      await expect(
        service.assertAccountUsable('acc-1', userId, 'TMT'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts a matching tracked account', async () => {
      prisma.financeAccount.findFirst.mockResolvedValue(account());

      await expect(
        service.assertAccountUsable('acc-1', userId, 'tmt'),
      ).resolves.toMatchObject({ id: 'acc-1' });
    });
  });

  describe('getNetWorthHistory', () => {
    it('produces one point per month and reports the change across the window', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({ openingBalance: D(100) }),
      ]);
      prisma.financeRecord.findMany.mockResolvedValue([
        {
          accountId: 'acc-1',
          type: 'INCOME',
          amount: D(50),
          operationDate: new Date('2026-02-10'),
        },
      ]);
      rateService.findNearestRateForDate.mockResolvedValue({
        rate: { id: 'r' },
        effectiveRate: D(1),
        isInverse: false,
      });

      const result = await service.getNetWorthHistory(userId, {
        from: '2026-01-01',
        to: '2026-03-31',
        interval: 'month',
        baseCurrency: 'TMT',
      });

      expect(result.points).toHaveLength(3);
      expect(result.points[0].netWorth).toBe('100.00');
      expect(result.points[1].netWorth).toBe('150.00');
      expect(result.points[2].netWorth).toBe('150.00');
      expect(result.change).toBe('50.00');
      expect(result.changePercent).toBe(50);
    });
  });

  describe('remove', () => {
    it('archives an account that still has history', async () => {
      prisma.financeAccount.findFirst.mockResolvedValue(account());
      prisma.financeRecord.count.mockResolvedValue(3);
      prisma.currencyConversion.count.mockResolvedValue(0);
      prisma.financeAccount.update.mockResolvedValue(
        account({ isArchived: true }),
      );

      await service.remove('acc-1', userId);

      expect(prisma.financeAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { isArchived: true },
      });
      expect(prisma.financeAccount.delete).not.toHaveBeenCalled();
    });

    it('deletes an account that was never used', async () => {
      prisma.financeAccount.findFirst.mockResolvedValue(account());
      prisma.financeRecord.count.mockResolvedValue(0);
      prisma.currencyConversion.count.mockResolvedValue(0);
      prisma.financeAccount.delete.mockResolvedValue(account());

      await service.remove('acc-1', userId);

      expect(prisma.financeAccount.delete).toHaveBeenCalled();
    });
  });

  describe('history rate fallback', () => {
    it('uses the nearest rate so an account is never dropped from the chart', async () => {
      prisma.financeAccount.findMany.mockResolvedValue([
        account({ currency: 'USD', openingBalance: D(100) }),
      ]);
      // Strict lookup would throw for early months; the nearest lookup answers.
      rateService.findNearestRateForDate.mockResolvedValue({
        rate: { id: 'r' },
        effectiveRate: D(2),
        isInverse: false,
      });

      const result = await service.getNetWorthHistory(userId, {
        from: '2026-01-01',
        to: '2026-02-28',
        interval: 'month',
        baseCurrency: 'TMT',
      });

      expect(result.points.every((p) => p.netWorth === '200.00')).toBe(true);
      expect(result.missingRates).toEqual([]);
      expect(rateService.findRateForDate).not.toHaveBeenCalled();
    });
  });
});
