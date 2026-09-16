import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlanService } from './plan.service';
import { AccountService } from './account.service';
import { RateService } from './rate.service';
import { PrismaService } from '../../prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const mockPrisma = () => ({
  financePlan: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  financeRecord: { groupBy: jest.fn().mockResolvedValue([]) },
  financeArticle: { findFirst: jest.fn() },
  financeAccount: { findFirst: jest.fn() },
});

const plan = (over: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  userId: 'user-1',
  kind: 'LIMIT',
  name: 'Food',
  amount: D(500),
  currency: 'USD',
  period: 'MONTH',
  startDate: new Date('2026-01-01'),
  endDate: null,
  articleId: 'art-1',
  accountId: null,
  isArchived: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...over,
});

const SEPTEMBER = {
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-30T23:59:59.999Z',
};

describe('PlanService', () => {
  let service: PlanService;
  let prisma: ReturnType<typeof mockPrisma>;
  let accountService: { getBalances: jest.Mock };
  let rateService: { findNearestRateForDate: jest.Mock };
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = mockPrisma();
    accountService = { getBalances: jest.fn() };
    rateService = { findNearestRateForDate: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountService, useValue: accountService },
        { provide: RateService, useValue: rateService },
      ],
    }).compile();

    service = moduleRef.get(PlanService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validation', () => {
    it('refuses a spending limit with no category', async () => {
      await expect(
        service.create(userId, {
          kind: 'LIMIT',
          name: 'Food',
          amount: '500',
          currency: 'USD',
          period: 'MONTH',
          startDate: SEPTEMBER.from,
        } as never),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('refuses a savings goal with no account', async () => {
      await expect(
        service.create(userId, {
          kind: 'GOAL',
          name: 'Car',
          amount: '10000',
          currency: 'USD',
          period: 'CUSTOM',
          startDate: SEPTEMBER.from,
          endDate: SEPTEMBER.to,
        } as never),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('refuses a custom period with no end date', async () => {
      await expect(
        service.create(userId, {
          kind: 'SAVING',
          name: 'Put aside',
          amount: '800',
          currency: 'USD',
          period: 'CUSTOM',
          startDate: SEPTEMBER.from,
        } as never),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('refuses a category belonging to someone else', async () => {
      prisma.financeArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.create(userId, {
          kind: 'LIMIT',
          name: 'Food',
          amount: '500',
          currency: 'USD',
          period: 'MONTH',
          startDate: SEPTEMBER.from,
          articleId: 'someone-elses',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('LIMIT progress', () => {
    it('measures spending on the category against the cap', async () => {
      prisma.financePlan.findMany.mockResolvedValue([plan()]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(412) } },
      ]);

      const [row] = await service.getProgress(userId, SEPTEMBER);

      expect(row.planned).toBe('500.00');
      expect(row.actual).toBe('412.00');
      expect(row.remaining).toBe('88.00');
      expect(row.progress).toBe(82.4);
      expect(row.isOverBudget).toBe(false);
    });

    it('flags an overspent limit and leaves progress at 100', async () => {
      prisma.financePlan.findMany.mockResolvedValue([
        plan({ name: 'Transport', amount: D(150) }),
      ]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(180) } },
      ]);

      const [row] = await service.getProgress(userId, SEPTEMBER);

      expect(row.remaining).toBe('-30.00');
      expect(row.progress).toBe(100);
      expect(row.isOverBudget).toBe(true);
    });

    it('scales a monthly cap to the window being asked about', async () => {
      prisma.financePlan.findMany.mockResolvedValue([plan()]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(3000) } },
      ]);

      const [row] = await service.getProgress(userId, {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.999Z',
      });

      // 500 a month, asked about a full year.
      expect(row.planned).toBe('6000.00');
      expect(row.actual).toBe('3000.00');
    });
  });

  describe('SAVING progress', () => {
    it('counts income minus expense against the target', async () => {
      prisma.financePlan.findMany.mockResolvedValue([
        plan({
          kind: 'SAVING',
          name: 'Put aside',
          amount: D(800),
          articleId: null,
        }),
      ]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'INCOME', _sum: { amount: D(2500) } },
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(1983) } },
      ]);

      const [row] = await service.getProgress(userId, SEPTEMBER);

      expect(row.actual).toBe('517.00');
      expect(row.planned).toBe('800.00');
      expect(row.isAchieved).toBe(false);
      expect(row.isOverBudget).toBe(false);
    });

    it('marks the target achieved once it is reached', async () => {
      prisma.financePlan.findMany.mockResolvedValue([
        plan({
          kind: 'SAVING',
          name: 'Put aside',
          amount: D(500),
          articleId: null,
        }),
      ]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'INCOME', _sum: { amount: D(2000) } },
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(1400) } },
      ]);

      const [row] = await service.getProgress(userId, SEPTEMBER);

      expect(row.actual).toBe('600.00');
      expect(row.isAchieved).toBe(true);
    });
  });

  describe('GOAL progress', () => {
    it('reads the account balance rather than the flow', async () => {
      prisma.financePlan.findMany.mockResolvedValue([
        plan({
          kind: 'GOAL',
          name: 'Car',
          amount: D(10000),
          period: 'CUSTOM',
          endDate: new Date('2026-12-31'),
          articleId: null,
          accountId: 'acc-1',
        }),
      ]);
      accountService.getBalances.mockResolvedValue({
        accounts: [
          {
            account: { id: 'acc-1', currency: 'USD' },
            balance: '3200',
          },
        ],
      });

      const [row] = await service.getProgress(userId, SEPTEMBER);

      expect(row.actual).toBe('3200.00');
      expect(row.planned).toBe('10000.00');
      expect(row.progress).toBe(32);
      expect(prisma.financeRecord.groupBy).not.toHaveBeenCalled();
    });

    it('does not scale a goal by the window', async () => {
      prisma.financePlan.findMany.mockResolvedValue([
        plan({
          kind: 'GOAL',
          amount: D(10000),
          period: 'MONTH',
          articleId: null,
          accountId: 'acc-1',
        }),
      ]);
      accountService.getBalances.mockResolvedValue({
        accounts: [{ account: { id: 'acc-1', currency: 'USD' }, balance: '0' }],
      });

      const [row] = await service.getProgress(userId, {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.999Z',
      });

      // A pot is one pot, however long you look at it.
      expect(row.planned).toBe('10000.00');
    });
  });

  describe('currency', () => {
    it('converts spending into the plan currency', async () => {
      prisma.financePlan.findMany.mockResolvedValue([plan()]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(100) } },
        { currency: 'TMT', type: 'EXPENSE', _sum: { amount: D(350) } },
      ]);
      rateService.findNearestRateForDate.mockResolvedValue({
        effectiveRate: D('0.2'),
      });

      const [row] = await service.getProgress(userId, SEPTEMBER);

      // 100 USD + 350 TMT at 0.2 = 170
      expect(row.actual).toBe('170.00');
      expect(row.rateMissing).toBe(false);
    });

    it('flags a missing rate instead of counting the amount as zero', async () => {
      prisma.financePlan.findMany.mockResolvedValue([plan()]);
      prisma.financeRecord.groupBy.mockResolvedValue([
        { currency: 'USD', type: 'EXPENSE', _sum: { amount: D(100) } },
        { currency: 'XXX', type: 'EXPENSE', _sum: { amount: D(999) } },
      ]);
      rateService.findNearestRateForDate.mockRejectedValue(
        new NotFoundException('no rate'),
      );

      const [row] = await service.getProgress(userId, SEPTEMBER);

      expect(row.actual).toBe('100.00');
      expect(row.rateMissing).toBe(true);
    });
  });

  it('skips plans whose window has closed', async () => {
    prisma.financePlan.findMany.mockResolvedValue([]);

    const rows = await service.getProgress(userId, SEPTEMBER);

    expect(rows).toEqual([]);
    expect(prisma.financePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          isArchived: false,
        }),
      }),
    );
  });
});
