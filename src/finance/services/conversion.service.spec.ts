import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConversionService } from './conversion.service';
import { RateService } from './rate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyConversion, CurrencyRate, Prisma } from '@prisma/client';

const mockPrisma = () => ({
  currencyConversion: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockRateService = () => ({
  findRateForDate: jest.fn(),
});

describe('ConversionService', () => {
  let service: ConversionService;
  let prisma: ReturnType<typeof mockPrisma>;
  let rateService: ReturnType<typeof mockRateService>;

  const userId = 'user-123';

  beforeEach(async () => {
    prisma = mockPrisma();
    rateService = mockRateService();
    prisma.$transaction.mockImplementation(
      async (actions: Promise<unknown>[]) => Promise.all(actions),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RateService, useValue: rateService },
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
});
