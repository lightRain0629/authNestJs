import {
  INestApplication,
  CanActivate,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/role.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  Role,
  FinanceArticleKind,
  FinanceRecordType,
  Prisma,
} from '@prisma/client';

const mockPrisma = () => ({
  financeArticle: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  financeRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  currencyRate: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  currencyConversion: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  roles: [Role.USER],
};

const allowAllGuard = (setUser = false): CanActivate => ({
  canActivate: (ctx: ExecutionContext) => {
    if (setUser) {
      const req = ctx.switchToHttp().getRequest();
      req.user = testUser;
    }
    return true;
  },
});

describe('Finance Module (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeAll(async () => {
    prisma = mockPrisma();
    prisma.$transaction.mockImplementation((actions: Promise<unknown>[]) =>
      Promise.all(actions),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard(true))
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard())
      .overrideGuard(ThrottlerGuard)
      .useValue(allowAllGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Articles', () => {
    it('POST /api/finance/articles - creates expense article', async () => {
      const mockArticle = {
        id: 'art-1',
        userId: testUser.id,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food & Dining',
        color: '#FF5733',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.financeArticle.findFirst.mockResolvedValue(null);
      prisma.financeArticle.create.mockResolvedValue(mockArticle);

      await request(app.getHttpServer())
        .post('/api/finance/articles')
        .set('Authorization', 'Bearer test')
        .send({
          kind: 'EXPENSE',
          name: 'Food & Dining',
          color: '#FF5733',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.id).toBe('art-1');
          expect(body.kind).toBe('EXPENSE');
          expect(body.name).toBe('Food & Dining');
          expect(body.color).toBe('#FF5733');
          expect(body.isArchived).toBe(false);
        });
    });

    it('GET /api/finance/articles - lists user articles', async () => {
      const mockArticles = [
        {
          id: 'art-1',
          userId: testUser.id,
          kind: FinanceArticleKind.EXPENSE,
          name: 'Food',
          color: null,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'art-2',
          userId: testUser.id,
          kind: FinanceArticleKind.INCOME,
          name: 'Salary',
          color: '#00FF00',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.financeArticle.findMany.mockResolvedValue(mockArticles);

      await request(app.getHttpServer())
        .get('/api/finance/articles')
        .set('Authorization', 'Bearer test')
        .expect(200)
        .expect(({ body }) => {
          expect(Array.isArray(body)).toBe(true);
          expect(body).toHaveLength(2);
        });
    });

    it('GET /api/finance/articles?kind=EXPENSE - filters by kind', async () => {
      const mockArticles = [
        {
          id: 'art-1',
          userId: testUser.id,
          kind: FinanceArticleKind.EXPENSE,
          name: 'Food',
          color: null,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.financeArticle.findMany.mockResolvedValue(mockArticles);

      await request(app.getHttpServer())
        .get('/api/finance/articles?kind=EXPENSE')
        .set('Authorization', 'Bearer test')
        .expect(200)
        .expect(({ body }) => {
          expect(body).toHaveLength(1);
          expect(body[0].kind).toBe('EXPENSE');
        });
    });
  });

  describe('Records', () => {
    it('POST /api/finance/records - creates expense record', async () => {
      const mockRecord = {
        id: 'rec-1',
        userId: testUser.id,
        type: FinanceRecordType.EXPENSE,
        amount: new Prisma.Decimal('150.50'),
        currency: 'USD',
        articleId: null,
        remark: 'Lunch',
        operationDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        article: null,
      };

      prisma.financeRecord.create.mockResolvedValue(mockRecord);

      await request(app.getHttpServer())
        .post('/api/finance/records')
        .set('Authorization', 'Bearer test')
        .send({
          type: 'EXPENSE',
          amount: '150.50',
          currency: 'USD',
          remark: 'Lunch',
          operationDate: '2024-01-15T12:00:00Z',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.id).toBe('rec-1');
          expect(body.type).toBe('EXPENSE');
          expect(body.amount).toBe('150.50');
          expect(body.currency).toBe('USD');
        });
    });

    it('POST /api/finance/records - creates record linked to article', async () => {
      const mockArticle = {
        id: 'art-1',
        userId: testUser.id,
        kind: FinanceArticleKind.EXPENSE,
        name: 'Food',
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRecord = {
        id: 'rec-2',
        userId: testUser.id,
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

      prisma.financeArticle.findFirst.mockResolvedValue(mockArticle);
      prisma.financeRecord.create.mockResolvedValue(mockRecord);

      await request(app.getHttpServer())
        .post('/api/finance/records')
        .set('Authorization', 'Bearer test')
        .send({
          type: 'EXPENSE',
          amount: '50.00',
          currency: 'EUR',
          articleId: 'art-1',
          operationDate: '2024-01-15T12:00:00Z',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.articleId).toBe('art-1');
          expect(body.article.name).toBe('Food');
        });
    });

    it('GET /api/finance/records - lists records with pagination', async () => {
      const mockRecords = [
        {
          id: 'rec-1',
          userId: testUser.id,
          type: FinanceRecordType.EXPENSE,
          amount: new Prisma.Decimal('100'),
          currency: 'USD',
          articleId: null,
          remark: null,
          operationDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
          article: null,
        },
      ];

      prisma.financeRecord.findMany.mockResolvedValue(mockRecords);
      prisma.financeRecord.count.mockResolvedValue(1);

      await request(app.getHttpServer())
        .get('/api/finance/records?page=1&limit=10')
        .set('Authorization', 'Bearer test')
        .expect(200)
        .expect(({ body }) => {
          expect(body.count).toBe(1);
          expect(body.current_page).toBe(1);
          expect(Array.isArray(body.results)).toBe(true);
          expect(body.results[0].amount).toBe('100');
        });
    });

    it('GET /api/finance/records - filters by date range', async () => {
      prisma.financeRecord.findMany.mockResolvedValue([]);
      prisma.financeRecord.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/api/finance/records?from=2024-01-01&to=2024-01-31')
        .set('Authorization', 'Bearer test')
        .expect(200);

      expect(prisma.financeRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            operationDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('Rates', () => {
    it('POST /api/finance/rates - creates currency rate', async () => {
      const mockRate = {
        id: 'rate-1',
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.92'),
        source: 'manual',
        effectiveAt: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyRate.create.mockResolvedValue(mockRate);

      await request(app.getHttpServer())
        .post('/api/finance/rates')
        .set('Authorization', 'Bearer test')
        .send({
          baseCurrency: 'USD',
          quoteCurrency: 'EUR',
          rate: '0.92',
          source: 'manual',
          effectiveAt: '2024-01-15T00:00:00Z',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.baseCurrency).toBe('USD');
          expect(body.quoteCurrency).toBe('EUR');
          expect(body.rate).toBe('0.92');
        });
    });

    it('GET /api/finance/rates/latest - gets latest rate', async () => {
      const mockRate = {
        id: 'rate-1',
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.92'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.currencyRate.findFirst.mockResolvedValue(mockRate);

      await request(app.getHttpServer())
        .get('/api/finance/rates/latest?base=USD&quote=EUR')
        .set('Authorization', 'Bearer test')
        .expect(200)
        .expect(({ body }) => {
          expect(body.rate.baseCurrency).toBe('USD');
          expect(body.effectiveRate).toBe('0.92');
          expect(body.isInverse).toBe(false);
        });
    });
  });

  describe('Conversions', () => {
    it('POST /api/finance/conversions - creates conversion', async () => {
      const mockRate = {
        id: 'rate-1',
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: new Prisma.Decimal('0.92'),
        source: 'manual',
        effectiveAt: new Date('2024-01-14'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockConversion = {
        id: 'conv-1',
        userId: testUser.id,
        fromAmount: new Prisma.Decimal('100'),
        fromCurrency: 'USD',
        toAmount: new Prisma.Decimal('92'),
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

      prisma.currencyRate.findFirst.mockResolvedValue(mockRate);
      prisma.currencyConversion.create.mockResolvedValue(mockConversion);

      await request(app.getHttpServer())
        .post('/api/finance/conversions')
        .set('Authorization', 'Bearer test')
        .send({
          fromAmount: '100',
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          operationDate: '2024-01-15T00:00:00Z',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.fromAmount).toBe('100');
          expect(body.toAmount).toBe('92');
          expect(body.rateUsed).toBe('0.92');
        });
    });
  });

  describe('Summary', () => {
    it('GET /api/finance/summary - returns totals by currency', async () => {
      prisma.financeRecord.groupBy.mockResolvedValue([
        {
          type: 'INCOME',
          currency: 'USD',
          _sum: { amount: new Prisma.Decimal('1000') },
        },
        {
          type: 'EXPENSE',
          currency: 'USD',
          _sum: { amount: new Prisma.Decimal('300') },
        },
      ]);

      prisma.currencyConversion.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/finance/summary?from=2024-01-01&to=2024-12-31')
        .set('Authorization', 'Bearer test')
        .expect(200)
        .expect(({ body }) => {
          expect(body.income).toHaveProperty('USD');
          expect(body.expense).toHaveProperty('USD');
          expect(body.income.USD).toBe('1000');
          expect(body.expense.USD).toBe('300');
        });
    });
  });

  describe('Validation', () => {
    it('POST /api/finance/records - rejects invalid amount format', async () => {
      await request(app.getHttpServer())
        .post('/api/finance/records')
        .set('Authorization', 'Bearer test')
        .send({
          type: 'EXPENSE',
          amount: 'invalid',
          currency: 'USD',
          operationDate: '2024-01-15T00:00:00Z',
        })
        .expect(400);
    });

    it('POST /api/finance/records - rejects invalid currency format', async () => {
      await request(app.getHttpServer())
        .post('/api/finance/records')
        .set('Authorization', 'Bearer test')
        .send({
          type: 'EXPENSE',
          amount: '100.00',
          currency: 'INVALID',
          operationDate: '2024-01-15T00:00:00Z',
        })
        .expect(400);
    });

    it('POST /api/finance/articles - rejects missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/finance/articles')
        .set('Authorization', 'Bearer test')
        .send({
          kind: 'EXPENSE',
          // missing name
        })
        .expect(400);
    });
  });
});
