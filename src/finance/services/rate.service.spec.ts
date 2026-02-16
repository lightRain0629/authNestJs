import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RateService } from './rate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyRate, Prisma } from '@prisma/client';

const mockPrisma = () => ({
  currencyRate: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
});

const TEST_USER_ID = 'test-user-id';

describe('RateService', () => {
  let service: RateService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const moduleRef = await Test.createTestingModule({
      providers: [RateService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findRateForDate', () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');

    it('should find direct rate USD/EUR', async () => {
      const directRate: CurrencyRate = {
        id: 'rate-1',
        userId: TEST_USER_ID,
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.92'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyRate.findFirst.mockResolvedValueOnce(directRate);

      const result = await service.findRateForDate(
        TEST_USER_ID,
        'USD',
        'EUR',
        mockDate,
      );

      expect(result.rate).toEqual(directRate);
      expect(result.effectiveRate.toString()).toBe('0.92');
      expect(result.isInverse).toBe(false);

      expect(prisma.currencyRate.findFirst).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          baseCurrency: 'USD',
          quoteCurrency: 'EUR',
          effectiveAt: { lte: mockDate },
        },
        orderBy: { effectiveAt: 'desc' },
      });
    });

    it('should find inverse rate when direct not available', async () => {
      const inverseRate: CurrencyRate = {
        id: 'rate-2',
        userId: TEST_USER_ID,
        baseCurrency: 'EUR',
        quoteCurrency: 'USD',
        rate: new Prisma.Decimal('1.0869565217'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Direct lookup returns null
      prisma.currencyRate.findFirst.mockResolvedValueOnce(null);
      // Inverse lookup returns the rate
      prisma.currencyRate.findFirst.mockResolvedValueOnce(inverseRate);

      const result = await service.findRateForDate(
        TEST_USER_ID,
        'USD',
        'EUR',
        mockDate,
      );

      expect(result.rate).toEqual(inverseRate);
      expect(result.isInverse).toBe(true);
      // 1 / 1.0869565217 ≈ 0.92
      expect(parseFloat(result.effectiveRate.toString())).toBeCloseTo(0.92, 2);
    });

    it('should throw NotFoundException when no rate found', async () => {
      prisma.currencyRate.findFirst.mockResolvedValue(null);
      prisma.currencyRate.findFirst.mockResolvedValue(null);

      await expect(
        service.findRateForDate(TEST_USER_ID, 'USD', 'TMT', mockDate),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.findRateForDate(TEST_USER_ID, 'USD', 'TMT', mockDate),
      ).rejects.toThrow('No FX rate found for USD/TMT');
    });

    it('should use rate with effectiveAt <= targetDate', async () => {
      const olderRate: CurrencyRate = {
        id: 'rate-3',
        userId: TEST_USER_ID,
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.90'),
        source: 'manual',
        effectiveAt: new Date('2024-01-10T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyRate.findFirst.mockResolvedValueOnce(olderRate);

      const targetDate = new Date('2024-01-12T00:00:00Z');
      const result = await service.findRateForDate(
        TEST_USER_ID,
        'USD',
        'EUR',
        targetDate,
      );

      expect(result.rate.effectiveAt).toEqual(olderRate.effectiveAt);
      expect(prisma.currencyRate.findFirst).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          baseCurrency: 'USD',
          quoteCurrency: 'EUR',
          effectiveAt: { lte: targetDate },
        },
        orderBy: { effectiveAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a rate with normalized currencies', async () => {
      const mockRate: CurrencyRate = {
        id: 'rate-new',
        userId: TEST_USER_ID,
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.92'),
        source: 'manual',
        effectiveAt: new Date('2024-01-15T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyRate.create.mockResolvedValue(mockRate);

      const result = await service.create(TEST_USER_ID, {
        baseCurrency: 'usd', // lowercase should be normalized
        quoteCurrency: 'eur',
        rate: '0.92',
        source: 'manual',
        effectiveAt: '2024-01-15T00:00:00Z',
      });

      expect(result).toEqual(mockRate);
      expect(prisma.currencyRate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          baseCurrency: 'USD',
          quoteCurrency: 'EUR',
        }),
      });
    });
  });
});
