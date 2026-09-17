import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = () => ({
  financeRecord: { findMany: jest.fn(), count: jest.fn() },
  currencyConversion: { findMany: jest.fn(), count: jest.fn() },
});

const day = (n: number) => new Date(`2024-01-${String(n).padStart(2, '0')}`);

const record = (id: string, dayOfMonth: number) => ({
  id,
  userId: 'user-1',
  type: 'EXPENSE' as const,
  amount: new Prisma.Decimal('10'),
  currency: 'USD',
  baseCurrency: null,
  baseRate: null,
  articleId: null,
  accountId: null,
  remark: null,
  operationDate: day(dayOfMonth),
  createdAt: day(dayOfMonth),
  updatedAt: day(dayOfMonth),
  article: null,
  account: null,
});

const transfer = (id: string, dayOfMonth: number) => ({
  id,
  userId: 'user-1',
  fromAmount: new Prisma.Decimal('50'),
  fromCurrency: 'USD',
  toAmount: new Prisma.Decimal('975'),
  toCurrency: 'TMT',
  rateUsed: new Prisma.Decimal('19.5'),
  rateId: null,
  isCustomRate: true,
  fromAccountId: 'acc-a',
  toAccountId: 'acc-b',
  feeAmount: null,
  feeCurrency: null,
  remark: null,
  operationDate: day(dayOfMonth),
  createdAt: day(dayOfMonth),
  updatedAt: day(dayOfMonth),
});

describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: ReturnType<typeof mockPrisma>;

  const userId = 'user-1';

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.financeRecord.findMany.mockResolvedValue([]);
    prisma.currencyConversion.findMany.mockResolvedValue([]);
    prisma.financeRecord.count.mockResolvedValue(0);
    prisma.currencyConversion.count.mockResolvedValue(0);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TransactionService);
  });

  afterEach(() => jest.clearAllMocks());

  it('interleaves records and transfers by date, newest first', async () => {
    prisma.financeRecord.findMany.mockResolvedValue([
      record('r-5', 5),
      record('r-1', 1),
    ]);
    prisma.currencyConversion.findMany.mockResolvedValue([
      transfer('t-4', 4),
      transfer('t-2', 2),
    ]);
    prisma.financeRecord.count.mockResolvedValue(2);
    prisma.currencyConversion.count.mockResolvedValue(2);

    const { items, total } = await service.findAll(userId, {});

    expect(items.map((i) => i.id)).toEqual(['r-5', 't-4', 't-2', 'r-1']);
    expect(items.map((i) => i.kind)).toEqual([
      'EXPENSE',
      'TRANSFER',
      'TRANSFER',
      'EXPENSE',
    ]);
    expect(total).toBe(4);
  });

  it('honours ascending order', async () => {
    prisma.financeRecord.findMany.mockResolvedValue([record('r-1', 1)]);
    prisma.currencyConversion.findMany.mockResolvedValue([transfer('t-2', 2)]);

    const { items } = await service.findAll(userId, { sortOrder: 'asc' });

    expect(items.map((i) => i.id)).toEqual(['r-1', 't-2']);
  });

  it('cuts an exact page even when one side supplies every row', async () => {
    // Page 2 of 2 needs rows 3 and 4; both come from the records side.
    prisma.financeRecord.findMany.mockResolvedValue([
      record('r-9', 9),
      record('r-8', 8),
      record('r-7', 7),
      record('r-6', 6),
    ]);
    prisma.financeRecord.count.mockResolvedValue(4);

    const { items } = await service.findAll(userId, { page: 2, limit: 2 });

    expect(items.map((i) => i.id)).toEqual(['r-7', 'r-6']);
  });

  it('fetches only as many rows per side as the page could need', async () => {
    await service.findAll(userId, { page: 3, limit: 10 });

    expect(prisma.financeRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30 }),
    );
    expect(prisma.currencyConversion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30 }),
    );
  });

  it('skips the conversions table entirely when filtering to a record kind', async () => {
    await service.findAll(userId, { kind: 'INCOME' });

    expect(prisma.currencyConversion.findMany).not.toHaveBeenCalled();
    expect(prisma.financeRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'INCOME' }),
      }),
    );
  });

  it('skips the records table entirely when filtering to transfers', async () => {
    await service.findAll(userId, { kind: 'TRANSFER' });

    expect(prisma.financeRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.currencyConversion.findMany).toHaveBeenCalled();
  });

  it('drops transfers when filtering by category, which they do not have', async () => {
    await service.findAll(userId, { articleId: 'art-1' });

    expect(prisma.currencyConversion.findMany).not.toHaveBeenCalled();
    expect(prisma.currencyConversion.count).not.toHaveBeenCalled();
  });

  it('matches an account on either side of a transfer', async () => {
    await service.findAll(userId, { accountId: 'acc-b' });

    const where = prisma.currencyConversion.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({
      OR: [{ fromAccountId: 'acc-b' }, { toAccountId: 'acc-b' }],
    });
  });

  it('combines a currency and a search into one AND, losing neither', async () => {
    await service.findAll(userId, { currency: 'USD', search: '>500' });

    const where = prisma.currencyConversion.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toEqual({
      OR: [{ fromCurrency: 'USD' }, { toCurrency: 'USD' }],
    });
    expect(where.AND[1].OR).toEqual([
      { remark: { contains: '>500', mode: 'insensitive' } },
      { fromAmount: { gt: new Prisma.Decimal('500') } },
      { toAmount: { gt: new Prisma.Decimal('500') } },
    ]);
  });

  it('carries the transfer detail through on a transfer entry', async () => {
    prisma.currencyConversion.findMany.mockResolvedValue([transfer('t-1', 1)]);

    const { items } = await service.findAll(userId, {});

    expect(items[0].record).toBeNull();
    expect(items[0].transfer).toMatchObject({
      fromCurrency: 'USD',
      toCurrency: 'TMT',
      rateUsed: '19.5',
      isCustomRate: true,
    });
  });
});
