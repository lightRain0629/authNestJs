import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceArticle, FinanceArticleKind } from '@prisma/client';

const mockPrisma = () => ({
  financeArticle: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  financeRecord: {
    count: jest.fn(),
  },
});

describe('ArticleService', () => {
  let service: ArticleService;
  let prisma: ReturnType<typeof mockPrisma>;

  const userId = 'user-123';

  beforeEach(async () => {
    prisma = mockPrisma();

    const moduleRef = await Test.createTestingModule({
      providers: [ArticleService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ArticleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an article', async () => {
      const mockArticle: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food & Dining',
        color: '#FF5733',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(null);
      prisma.financeArticle.create.mockResolvedValue(mockArticle);

      const result = await service.create(userId, {
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food & Dining',
        color: '#FF5733',
      });

      expect(result).toEqual(mockArticle);
    });

    it('should reject duplicate article name for same kind (case-insensitive)', async () => {
      const existingArticle: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'food',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(existingArticle);

      await expect(
        service.create(userId, {
          kind: FinanceArticleKind.EXPENSE,
          name: 'FOOD', // Different case, should still conflict
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow same name for different kinds', async () => {
      // No existing INCOME article with name "Bonus"
      prisma.financeArticle.findFirst.mockResolvedValue(null);
      prisma.financeArticle.create.mockResolvedValue({
        id: 'art-2',
        userId,
        kind: FinanceArticleKind.INCOME,
        name: 'Bonus',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(userId, {
        kind: FinanceArticleKind.INCOME,
        name: 'Bonus',
      });

      expect(result.kind).toBe(FinanceArticleKind.INCOME);
    });
  });

  describe('validateArticleForRecord', () => {
    it('should pass validation for matching kind', async () => {
      const article: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(article);

      const result = await service.validateArticleForRecord(
        'art-1',
        userId,
        FinanceArticleKind.EXPENSE,
      );

      expect(result).toEqual(article);
    });

    it('should reject when article kind does not match record type', async () => {
      const incomeArticle: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.INCOME,
        name: 'Salary',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(incomeArticle);

      await expect(
        service.validateArticleForRecord(
          'art-1',
          userId,
          FinanceArticleKind.EXPENSE,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateArticleForRecord(
          'art-1',
          userId,
          FinanceArticleKind.EXPENSE,
        ),
      ).rejects.toThrow(
        'Article kind (INCOME) does not match record type (EXPENSE)',
      );
    });

    it('should reject archived articles', async () => {
      const archivedArticle: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Old Category',
        color: null,
        isArchived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(archivedArticle);

      await expect(
        service.validateArticleForRecord(
          'art-1',
          userId,
          FinanceArticleKind.EXPENSE,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateArticleForRecord(
          'art-1',
          userId,
          FinanceArticleKind.EXPENSE,
        ),
      ).rejects.toThrow('Cannot use archived article');
    });

    it('should reject if article belongs to another user', async () => {
      prisma.financeArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.validateArticleForRecord(
          'art-1',
          'other-user',
          FinanceArticleKind.EXPENSE,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should archive article if it has records', async () => {
      const article: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(article);
      prisma.financeRecord.count.mockResolvedValue(5); // Has records
      prisma.financeArticle.update.mockResolvedValue({
        ...article,
        isArchived: true,
      });

      const result = await service.remove('art-1', userId);

      expect(result.isArchived).toBe(true);
      expect(prisma.financeArticle.update).toHaveBeenCalledWith({
        where: { id: 'art-1' },
        data: { isArchived: true },
      });
      expect(prisma.financeArticle.delete).not.toHaveBeenCalled();
    });

    it('should hard delete article if it has no records', async () => {
      const article: FinanceArticle = {
        id: 'art-1',
        userId,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Empty Category',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(article);
      prisma.financeRecord.count.mockResolvedValue(0); // No records
      prisma.financeArticle.delete.mockResolvedValue(article);

      await service.remove('art-1', userId);

      expect(prisma.financeArticle.delete).toHaveBeenCalledWith({
        where: { id: 'art-1' },
      });
      expect(prisma.financeArticle.update).not.toHaveBeenCalled();
    });
  });

  describe('user scoping', () => {
    it('should not allow accessing another user articles', async () => {
      prisma.financeArticle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('art-1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
