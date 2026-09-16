import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecordDto, UpdateRecordDto, ListRecordsDto } from '../dto';
import { FinanceRecord, FinanceArticleKind, Prisma } from '@prisma/client';
import { ArticleService } from './article.service';
import { AccountService } from './account.service';

type RecordWithArticle = FinanceRecord & {
  article?: {
    id: string;
    name: string;
    kind: string;
    color: string | null;
  } | null;
  account?: {
    id: string;
    name: string;
    kind: string;
    currency: string;
    color: string | null;
  } | null;
};

@Injectable()
export class RecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articleService: ArticleService,
    private readonly accountService: AccountService,
  ) {}

  async create(
    userId: string,
    dto: CreateRecordDto,
  ): Promise<RecordWithArticle> {
    if (dto.articleId) {
      await this.articleService.validateArticleForRecord(
        dto.articleId,
        userId,
        dto.type as unknown as FinanceArticleKind,
      );
    }

    if (dto.accountId) {
      await this.accountService.assertAccountUsable(
        dto.accountId,
        userId,
        dto.currency,
      );
    }

    return this.prisma.financeRecord.create({
      data: {
        userId,
        type: dto.type,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency.toUpperCase(),
        articleId: dto.articleId ?? null,
        accountId: dto.accountId ?? null,
        remark: dto.remark ?? null,
        operationDate: new Date(dto.operationDate),
      },
      include: {
        article: {
          select: { id: true, name: true, kind: true, color: true },
        },
        account: {
          select: {
            id: true,
            name: true,
            kind: true,
            currency: true,
            color: true,
          },
        },
      },
    });
  }

  async findAll(
    userId: string,
    query: ListRecordsDto,
  ): Promise<{ items: RecordWithArticle[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceRecordWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.currency ? { currency: query.currency.toUpperCase() } : {}),
      ...(query.articleId ? { articleId: query.articleId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.from || query.to
        ? {
            operationDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search ? { OR: this.buildSearchFilters(query.search) } : {}),
    };

    const orderBy: Prisma.FinanceRecordOrderByWithRelationInput[] = [];
    const sortField = query.sortBy ?? 'operationDate';
    const sortOrder = query.sortOrder ?? 'desc';

    if (sortField === 'operationDate') {
      orderBy.push({ operationDate: sortOrder });
      orderBy.push({ createdAt: 'desc' });
    } else if (sortField === 'createdAt') {
      orderBy.push({ createdAt: sortOrder });
    } else if (sortField === 'amount') {
      orderBy.push({ amount: sortOrder });
      orderBy.push({ operationDate: 'desc' });
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financeRecord.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          article: {
            select: { id: true, name: true, kind: true, color: true },
          },
          account: {
            select: {
              id: true,
              name: true,
              kind: true,
              currency: true,
              color: true,
            },
          },
        },
      }),
      this.prisma.financeRecord.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Text search also understands amounts, so "1200", ">500" or "100-250" find
   * records by how much they were rather than only by what they were called.
   */
  private buildSearchFilters(search: string): Prisma.FinanceRecordWhereInput[] {
    const filters: Prisma.FinanceRecordWhereInput[] = [
      { remark: { contains: search, mode: 'insensitive' } },
      { article: { name: { contains: search, mode: 'insensitive' } } },
    ];

    const amountFilter = RecordService.parseAmountQuery(search);
    if (amountFilter) {
      filters.push({ amount: amountFilter });
    }

    return filters;
  }

  /** Recognises "1200", ">=500", "<10.5" and "100-250". */
  static parseAmountQuery(
    search: string,
  ): Prisma.DecimalFilter<'FinanceRecord'> | null {
    const text = search.trim();
    if (!text) return null;

    const range = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (range) {
      const low = new Prisma.Decimal(range[1]);
      const high = new Prisma.Decimal(range[2]);
      return low.lessThanOrEqualTo(high)
        ? { gte: low, lte: high }
        : { gte: high, lte: low };
    }

    const comparison = text.match(/^(>=|<=|>|<)\s*(\d+(?:\.\d+)?)$/);
    if (comparison) {
      const value = new Prisma.Decimal(comparison[2]);
      switch (comparison[1]) {
        case '>':
          return { gt: value };
        case '>=':
          return { gte: value };
        case '<':
          return { lt: value };
        default:
          return { lte: value };
      }
    }

    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    return { equals: new Prisma.Decimal(text) };
  }

  async findOne(id: string, userId: string): Promise<RecordWithArticle> {
    const record = await this.prisma.financeRecord.findFirst({
      where: { id, userId },
      include: {
        article: {
          select: { id: true, name: true, kind: true, color: true },
        },
        account: {
          select: {
            id: true,
            name: true,
            kind: true,
            currency: true,
            color: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Record not found');
    }

    return record;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateRecordDto,
  ): Promise<RecordWithArticle> {
    const record = await this.findOne(id, userId);

    const newType = dto.type ?? record.type;

    if (dto.articleId) {
      await this.articleService.validateArticleForRecord(
        dto.articleId,
        userId,
        newType as unknown as FinanceArticleKind,
      );
    }

    const newCurrency = dto.currency ?? record.currency;
    if (dto.accountId) {
      await this.accountService.assertAccountUsable(
        dto.accountId,
        userId,
        newCurrency,
      );
    } else if (
      dto.accountId === undefined &&
      record.accountId &&
      dto.currency !== undefined
    ) {
      // Currency changed while still pinned to an account: keep them in sync.
      await this.accountService.assertAccountUsable(
        record.accountId,
        userId,
        newCurrency,
      );
    }

    const updateData: Prisma.FinanceRecordUpdateInput = {};

    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.amount !== undefined)
      updateData.amount = new Prisma.Decimal(dto.amount);
    if (dto.currency !== undefined)
      updateData.currency = dto.currency.toUpperCase();
    if (dto.articleId !== undefined) {
      if (dto.articleId === null) {
        updateData.article = { disconnect: true };
      } else {
        updateData.article = { connect: { id: dto.articleId } };
      }
    }
    if (dto.accountId !== undefined) {
      if (dto.accountId === null) {
        updateData.account = { disconnect: true };
      } else {
        updateData.account = { connect: { id: dto.accountId } };
      }
    }
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.operationDate !== undefined)
      updateData.operationDate = new Date(dto.operationDate);

    return this.prisma.financeRecord.update({
      where: { id },
      data: updateData,
      include: {
        article: {
          select: { id: true, name: true, kind: true, color: true },
        },
        account: {
          select: {
            id: true,
            name: true,
            kind: true,
            currency: true,
            color: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string): Promise<FinanceRecord> {
    await this.findOne(id, userId);

    return this.prisma.financeRecord.delete({
      where: { id },
    });
  }
}
