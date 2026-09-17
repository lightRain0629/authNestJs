import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConversionService } from './conversion.service';
import { RateService } from './rate.service';
import { AccountService } from './account.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyConversion, CurrencyRate, Prisma } from '@prisma/client';

const mockPrisma = () => ({
  currencyConversion: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockRateService = () => ({
  findRateForDate: jest.fn(),
});

const mockAccountService = () => ({
  assertAccountUsable: jest.fn(),
});

describe('ConversionService', () => {
  let service: ConversionService;
  let prisma: ReturnType<typeof mockPrisma>;
  let rateService: ReturnType<typeof mockRateService>;
  let accountService: ReturnType<typeof mockAccountService>;

  const userId = 'user-123';

  beforeEach(async () => {
    prisma = mockPrisma();
    rateService = mockRateService();
    accountService = mockAccountService();
    prisma.$transaction.mockImplementation(
      async (actions: Promise<unknown>[]) => Promise.all(actions),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RateService, useValue: rateService },
        { provide: AccountService, useValue: accountService },
      ],
    }).compile();

    service = moduleRef.get(ConversionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create conversion using direct rate', async () => {
      const mockRate: CurrencyRate = {
        id: 'rate-1',
        userId,
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.92'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      rateService.findRateForDate.mockResolvedValue({
        rate: mockRate,
        effectiveRate: new Prisma.Decimal('0.92'),
        isInverse: false,
      });

      const expectedToAmount = new Prisma.Decimal('100').mul(
        new Prisma.Decimal('0.92'),
      );

      const mockConversion: CurrencyConversion = {
        id: 'conv-1',
        userId,
        fromAmount: new Prisma.Decimal('100'),
        fromCurrency: 'USD',
        toAmount: expectedToAmount,
        toCurrency: 'EUR',
        rateUsed: new Prisma.Decimal('0.92'),
        rateId: 'rate-1',
        isCustomRate: false,
        fromAccountId: null,
        toAccountId: null,
        feeAmount: null,
        feeCurrency: null,
        remark: null,
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyConversion.create.mockResolvedValue(mockConversion);

      const result = await service.create(userId, {
        fromAmount: '100',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        operationDate: '2024-01-15T00:00:00Z',
      });

      expect(result).toEqual(mockConversion);
      expect(rateService.findRateForDate).toHaveBeenCalledWith(
        userId,
        'USD',
        'EUR',
        new Date('2024-01-15T00:00:00Z'),
      );
    });

    it('should create conversion with fee', async () => {
      const mockRate: CurrencyRate = {
        id: 'rate-1',
        userId,
        baseCurrency: 'USD',
        quoteCurrency: 'TMT',
        rate: new Prisma.Decimal('3.5'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      rateService.findRateForDate.mockResolvedValue({
        rate: mockRate,
        effectiveRate: new Prisma.Decimal('3.5'),
        isInverse: false,
      });

      const mockConversion: CurrencyConversion = {
        id: 'conv-2',
        userId,
        fromAmount: new Prisma.Decimal('100'),
        fromCurrency: 'USD',
        toAmount: new Prisma.Decimal('350'),
        toCurrency: 'TMT',
        rateUsed: new Prisma.Decimal('3.5'),
        rateId: 'rate-1',
        isCustomRate: false,
        fromAccountId: null,
        toAccountId: null,
        feeAmount: new Prisma.Decimal('5'),
        feeCurrency: 'USD',
        remark: 'Exchange at bank',
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyConversion.create.mockResolvedValue(mockConversion);

      const result = await service.create(userId, {
        fromAmount: '100',
        fromCurrency: 'USD',
        toCurrency: 'TMT',
        operationDate: '2024-01-15T00:00:00Z',
        feeAmount: '5',
        feeCurrency: 'USD',
        remark: 'Exchange at bank',
      });

      expect(result.feeAmount?.toString()).toBe('5');
      expect(result.feeCurrency).toBe('USD');
    });

    it('should throw UnprocessableEntityException when no rate found', async () => {
      rateService.findRateForDate.mockRejectedValue(
        new NotFoundException('No FX rate found for USD/XYZ'),
      );

      await expect(
        service.create(userId, {
          fromAmount: '100',
          fromCurrency: 'USD',
          toCurrency: 'XYZ',
          operationDate: '2024-01-15T00:00:00Z',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should use inverse rate when direct not available', async () => {
      const mockInverseRate: CurrencyRate = {
        id: 'rate-2',
        userId,
        baseCurrency: 'EUR',
        quoteCurrency: 'USD',
        rate: new Prisma.Decimal('1.0869565'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const inverseEffectiveRate = new Prisma.Decimal(1).div(
        new Prisma.Decimal('1.0869565'),
      );

      rateService.findRateForDate.mockResolvedValue({
        rate: mockInverseRate,
        effectiveRate: inverseEffectiveRate,
        isInverse: true,
      });

      const mockConversion: CurrencyConversion = {
        id: 'conv-3',
        userId,
        fromAmount: new Prisma.Decimal('100'),
        fromCurrency: 'USD',
        toAmount: new Prisma.Decimal('100').mul(inverseEffectiveRate),
        toCurrency: 'EUR',
        rateUsed: inverseEffectiveRate,
        rateId: 'rate-2',
        isCustomRate: false,
        fromAccountId: null,
        toAccountId: null,
        feeAmount: null,
        feeCurrency: null,
        remark: null,
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyConversion.create.mockResolvedValue(mockConversion);

      const result = await service.create(userId, {
        fromAmount: '100',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        operationDate: '2024-01-15T00:00:00Z',
      });

      expect(parseFloat(result.rateUsed.toString())).toBeCloseTo(0.92, 2);
    });
  });

  describe('user scoping', () => {
    it('should not allow accessing another user conversions', async () => {
      prisma.currencyConversion.findFirst.mockResolvedValue(null);

      await expect(service.findOne('conv-1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only return user own conversions', async () => {
      const userConversions: CurrencyConversion[] = [];

      prisma.currencyConversion.findMany.mockResolvedValue(userConversions);
      prisma.currencyConversion.count.mockResolvedValue(0);

      await service.findAll(userId, { page: 1, limit: 10 });

      expect(prisma.currencyConversion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId }),
        }),
      );
    });
  });

  describe('custom rate', () => {
    const baseConversion: CurrencyConversion = {
      id: 'conv-custom',
      userId,
      fromAmount: new Prisma.Decimal('100'),
      fromCurrency: 'USD',
      toAmount: new Prisma.Decimal('1950'),
      toCurrency: 'TMT',
      rateUsed: new Prisma.Decimal('19.5'),
      rateId: null,
      isCustomRate: true,
      fromAccountId: null,
      toAccountId: null,
      feeAmount: null,
      feeCurrency: null,
      remark: null,
      operationDate: new Date('2024-01-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('books at the supplied rate without touching the rate table', async () => {
      prisma.currencyConversion.create.mockResolvedValue(baseConversion);

      await service.create(userId, {
        fromAmount: '100',
        fromCurrency: 'USD',
        toCurrency: 'TMT',
        operationDate: '2024-01-15T00:00:00Z',
        rate: '19.5',
      });

      expect(rateService.findRateForDate).not.toHaveBeenCalled();
      const data = prisma.currencyConversion.create.mock.calls[0][0].data;
      expect(data.rateUsed.toString()).toBe('19.5');
      expect(data.toAmount.toString()).toBe('1950');
      expect(data.rateId).toBeNull();
      expect(data.isCustomRate).toBe(true);
    });

    it('succeeds with a custom rate even when no rate exists for the pair', async () => {
      rateService.findRateForDate.mockRejectedValue(
        new NotFoundException('nope'),
      );
      prisma.currencyConversion.create.mockResolvedValue(baseConversion);

      await expect(
        service.create(userId, {
          fromAmount: '100',
          fromCurrency: 'USD',
          toCurrency: 'TMT',
          operationDate: '2024-01-15T00:00:00Z',
          rate: '19.5',
        }),
      ).resolves.toBeDefined();
    });

    it('rejects a custom rate on a same-currency transfer', async () => {
      await expect(
        service.create(userId, {
          fromAmount: '100',
          fromCurrency: 'USD',
          toCurrency: 'USD',
          operationDate: '2024-01-15T00:00:00Z',
          rate: '19.5',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a rate of zero', async () => {
      await expect(
        service.create(userId, {
          fromAmount: '100',
          fromCurrency: 'USD',
          toCurrency: 'TMT',
          operationDate: '2024-01-15T00:00:00Z',
          rate: '0',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('update', () => {
    const existing: CurrencyConversion = {
      id: 'conv-1',
      userId,
      fromAmount: new Prisma.Decimal('100'),
      fromCurrency: 'USD',
      toAmount: new Prisma.Decimal('1950'),
      toCurrency: 'TMT',
      rateUsed: new Prisma.Decimal('19.5'),
      rateId: null,
      isCustomRate: true,
      fromAccountId: 'acc-from',
      toAccountId: 'acc-to',
      feeAmount: null,
      feeCurrency: null,
      remark: 'old note',
      operationDate: new Date('2024-01-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      prisma.currencyConversion.findFirst.mockResolvedValue(existing);
      prisma.currencyConversion.update.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          ...existing,
          ...args.data,
        }),
      );
    });

    it('keeps a custom rate when only the remark changes', async () => {
      await service.update('conv-1', userId, { remark: 'new note' });

      expect(rateService.findRateForDate).not.toHaveBeenCalled();
      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.rateUsed.toString()).toBe('19.5');
      expect(data.isCustomRate).toBe(true);
      expect(data.remark).toBe('new note');
    });

    it('recomputes toAmount at the kept rate when the amount changes', async () => {
      await service.update('conv-1', userId, { fromAmount: '200' });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.toAmount.toString()).toBe('3900');
    });

    it('re-rates from the table once a currency changes', async () => {
      rateService.findRateForDate.mockResolvedValue({
        rate: { id: 'rate-9' } as CurrencyRate,
        effectiveRate: new Prisma.Decimal('0.92'),
        isInverse: false,
      });

      await service.update('conv-1', userId, { toCurrency: 'EUR' });

      expect(rateService.findRateForDate).toHaveBeenCalledWith(
        userId,
        'USD',
        'EUR',
        existing.operationDate,
      );
      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.rateUsed.toString()).toBe('0.92');
      expect(data.rateId).toBe('rate-9');
      expect(data.isCustomRate).toBe(false);
    });

    it('takes a new explicit rate over the one already booked', async () => {
      await service.update('conv-1', userId, { rate: '21' });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.rateUsed.toString()).toBe('21');
      expect(data.toAmount.toString()).toBe('2100');
      expect(data.isCustomRate).toBe(true);
    });

    it('drops a custom rate back to the table when sent null', async () => {
      rateService.findRateForDate.mockResolvedValue({
        rate: { id: 'rate-official' } as CurrencyRate,
        effectiveRate: new Prisma.Decimal('3.5'),
        isInverse: false,
      });

      await service.update('conv-1', userId, { rate: null });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.rateUsed.toString()).toBe('3.5');
      expect(data.rateId).toBe('rate-official');
      expect(data.isCustomRate).toBe(false);
    });

    it('clears the fee and the note when sent null', async () => {
      prisma.currencyConversion.findFirst.mockResolvedValue({
        ...existing,
        feeAmount: new Prisma.Decimal('2'),
        feeCurrency: 'USD',
      });

      await service.update('conv-1', userId, {
        feeAmount: null,
        feeCurrency: null,
        remark: null,
      });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.feeAmount).toBeNull();
      expect(data.feeCurrency).toBeNull();
      expect(data.remark).toBeNull();
    });

    it('leaves the fee and the note alone when they are not sent', async () => {
      prisma.currencyConversion.findFirst.mockResolvedValue({
        ...existing,
        feeAmount: new Prisma.Decimal('2'),
        feeCurrency: 'USD',
      });

      await service.update('conv-1', userId, { fromAmount: '150' });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.feeAmount.toString()).toBe('2');
      expect(data.feeCurrency).toBe('USD');
      expect(data.remark).toBe('old note');
    });

    it('unlinks an account leg when sent null', async () => {
      await service.update('conv-1', userId, { toAccountId: null });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.toAccountId).toBeNull();
      expect(data.fromAccountId).toBe('acc-from');
    });

    it('keeps both legs when neither is sent', async () => {
      await service.update('conv-1', userId, { remark: 'just a note' });

      const data = prisma.currencyConversion.update.mock.calls[0][0].data;
      expect(data.fromAccountId).toBe('acc-from');
      expect(data.toAccountId).toBe('acc-to');
    });

    it('rejects moving both legs onto the same account', async () => {
      await expect(
        service.update('conv-1', userId, { toAccountId: 'acc-from' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('validates the account against the currency it will hold', async () => {
      rateService.findRateForDate.mockResolvedValue({
        rate: { id: 'rate-9' } as CurrencyRate,
        effectiveRate: new Prisma.Decimal('0.92'),
        isInverse: false,
      });

      await service.update('conv-1', userId, { toCurrency: 'EUR' });

      expect(accountService.assertAccountUsable).toHaveBeenCalledWith(
        'acc-to',
        userId,
        'EUR',
      );
    });
  });
});
