import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecordService } from './record.service';
import { ArticleService } from './article.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FinanceRecord,
  FinanceRecordType,
  FinanceArticle,
  FinanceArticleKind,
  Prisma,
} from '@prisma/client';

const mockPrisma = () => ({
  financeRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockArticleService = () => ({
  findOne: jest.fn(),
  validateArticleForRecord: jest.fn(),
});

describe('RecordService', () => {
  let service: RecordService;
  let prisma: ReturnType<typeof mockPrisma>;
  let articleService: ReturnType<typeof mockArticleService>;

  const userId = 'user-123';

  beforeEach(async () => {
    prisma = mockPrisma();
    articleService = mockArticleService();
    prisma.$transaction.mockImplementation(
      async (actions: Promise<unknown>[]) => Promise.all(actions),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecordService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArticleService, useValue: articleService },
      ],
    }).compile();

    service = moduleRef.get(RecordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a record without article', async () => {
      const mockRecord: FinanceRecord & { article: null } = {
        id: 'rec-1',
        userId,
        type: FinanceRecordType.EXPENSE,
        amount: new Prisma.Decimal('100.00'),
        currency: 'USD',
        articleId: null,
        remark: 'Test expense',
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        article: null,
      };

      prisma.financeRecord.create.mockResolvedValue(mockRecord);

      const result = await service.create(userId, {
        type: FinanceRecordType.EXPENSE,
        amount: '100.00',
        currency: 'USD',
        remark: 'Test expense',
        operationDate: '2024-01-15T00:00:00Z',
      });

      expect(result).toEqual(mockRecord);
      expect(articleService.validateArticleForRecord).not.toHaveBeenCalled();
    });

    it('should validate article belongs to user and matches type', async () => {
      const mockArticle: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRecord: FinanceRecord & { article: { id: string; name: string; kind: string; color: null } } = {
        id: 'rec-2',
        userId,
        type: FinanceRecordType.EXPENSE,
        amount: new Prisma.Decimal('50.00'),
        currency: 'EUR',
        articleId: 'art-1',
        remark: null,
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        article: { id: 'art-1', name: 'Food', kind: 'EXPENSE', color: null },
      };

      articleService.validateArticleForRecord.mockResolvedValue(mockArticle);
      prisma.financeRecord.create.mockResolvedValue(mockRecord);

      const result = await service.create(userId, {
        type: FinanceRecordType.EXPENSE,
        amount: '50.00',
        currency: 'EUR',
        articleId: 'art-1',
        operationDate: '2024-01-15T00:00:00Z',
      });

      expect(articleService.validateArticleForRecord).toHaveBeenCalledWith(
        'art-1',
        userId,
        FinanceArticleKind.EXPENSE,
      );
      expect(result.articleId).toBe('art-1');
    });

    it('should reject if article kind does not match record type', async () => {
      articleService.validateArticleForRecord.mockRejectedValue(
        new BadRequestException('Article kind (INCOME) does not match record type (EXPENSE)'),
      );

      await expect(
        service.create(userId, {
          type: FinanceRecordType.EXPENSE,
          amount: '50.00',
          currency: 'EUR',
          articleId: 'income-article-id',
          operationDate: '2024-01-15T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should normalize currency to uppercase', async () => {
      const mockRecord: FinanceRecord & { article: null } = {
        id: 'rec-3',
        userId,
        type: FinanceRecordType.INCOME,
        amount: new Prisma.Decimal('200.00'),
        currency: 'EUR',
        articleId: null,
        remark: null,
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        article: null,
      };

      prisma.financeRecord.create.mockResolvedValue(mockRecord);

      await service.create(userId, {
        type: FinanceRecordType.INCOME,
        amount: '200.00',
        currency: 'eur', // lowercase
        operationDate: '2024-01-15T00:00:00Z',
      });

      expect(prisma.financeRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'EUR',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return record if user owns it', async () => {
      const mockRecord: FinanceRecord & { article: null } = {
        id: 'rec-1',
        userId,
        type: FinanceRecordType.EXPENSE,
        amount: new Prisma.Decimal('100.00'),
        currency: 'USD',
        articleId: null,
        remark: null,
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        article: null,
      };

      prisma.financeRecord.findFirst.mockResolvedValue(mockRecord);

      const result = await service.findOne('rec-1', userId);

      expect(result).toEqual(mockRecord);
      expect(prisma.financeRecord.findFirst).toHaveBeenCalledWith({
        where: { id: 'rec-1', userId },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if record belongs to another user', async () => {
      prisma.financeRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('rec-1', 'other-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('user scoping', () => {
    it('should only return records belonging to the user', async () => {
      const userRecords: (FinanceRecord & { article: null })[] = [
        {
          id: 'rec-1',
          userId,
          type: FinanceRecordType.EXPENSE,
          amount: new Prisma.Decimal('100.00'),
          currency: 'USD',
          articleId: null,
          remark: null,
          operationDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
          article: null,
        },
      ];

      prisma.financeRecord.findMany.mockResolvedValue(userRecords);
      prisma.financeRecord.count.mockResolvedValue(1);

      await service.findAll(userId, { page: 1, limit: 10 });

      expect(prisma.financeRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId }),
        }),
      );
    });

    it('should not allow accessing another user records', async () => {
      prisma.financeRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('someone-elses-record', userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
