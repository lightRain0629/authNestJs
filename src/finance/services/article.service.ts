import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArticleDto, UpdateArticleDto, ListArticlesDto } from '../dto';
import { FinanceArticle, FinanceArticleKind, Prisma } from '@prisma/client';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateArticleDto): Promise<FinanceArticle> {
    const normalizedName = dto.name.trim();

    const existing = await this.prisma.financeArticle.findFirst({
      where: {
        userId,
        kind: dto.kind,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Article with name "${normalizedName}" already exists for this kind`,
      );
    }

    return this.prisma.financeArticle.create({
      data: {
        userId,
        kind: dto.kind,
        name: normalizedName,
        color: dto.color ?? null,
      },
    });
  }

  async findAll(
    userId: string,
    query: ListArticlesDto,
  ): Promise<FinanceArticle[]> {
    const where: Prisma.FinanceArticleWhereInput = {
      userId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.includeArchived ? {} : { isArchived: false }),
    };

    return this.prisma.financeArticle.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, userId: string): Promise<FinanceArticle> {
    const article = await this.prisma.financeArticle.findFirst({
      where: { id, userId },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateArticleDto,
  ): Promise<FinanceArticle> {
    const article = await this.findOne(id, userId);

    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim();
      const existing = await this.prisma.financeArticle.findFirst({
        where: {
          userId,
          kind: article.kind,
          name: { equals: normalizedName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Article with name "${normalizedName}" already exists for this kind`,
        );
      }

      dto.name = normalizedName;
    }

    return this.prisma.financeArticle.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string): Promise<FinanceArticle> {
    await this.findOne(id, userId);

    const recordCount = await this.prisma.financeRecord.count({
      where: { articleId: id },
    });

    if (recordCount > 0) {
      return this.prisma.financeArticle.update({
        where: { id },
        data: { isArchived: true },
      });
    }

    return this.prisma.financeArticle.delete({
      where: { id },
    });
  }

  async validateArticleForRecord(
    articleId: string,
    userId: string,
    recordType: FinanceArticleKind,
  ): Promise<FinanceArticle> {
    const article = await this.findOne(articleId, userId);

    if (article.kind !== recordType) {
      throw new BadRequestException(
        `Article kind (${article.kind}) does not match record type (${recordType})`,
      );
    }

    if (article.isArchived) {
      throw new BadRequestException('Cannot use archived article');
    }

    return article;
  }
}
