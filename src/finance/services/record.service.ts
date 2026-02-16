import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecordDto, UpdateRecordDto, ListRecordsDto } from '../dto';
import { FinanceRecord, FinanceArticleKind, Prisma } from '@prisma/client';
import { ArticleService } from './article.service';

type RecordWithArticle = FinanceRecord & {
  article?: {
    id: string;
    name: string;
    kind: string;
    color: string | null;
  } | null;
};

@Injectable()
export class RecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articleService: ArticleService,
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

    return this.prisma.financeRecord.create({
      data: {
        userId,
        type: dto.type,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency.toUpperCase(),
        articleId: dto.articleId ?? null,
        remark: dto.remark ?? null,
        operationDate: new Date(dto.operationDate),
      },
      include: {
        article: {
          select: { id: true, name: true, kind: true, color: true },
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
      ...(query.from || query.to
        ? {
            operationDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { remark: { contains: query.search, mode: 'insensitive' } },
              {
                article: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
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
        },
      }),
      this.prisma.financeRecord.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string, userId: string): Promise<RecordWithArticle> {
    const record = await this.prisma.financeRecord.findFirst({
      where: { id, userId },
      include: {
        article: {
          select: { id: true, name: true, kind: true, color: true },
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
