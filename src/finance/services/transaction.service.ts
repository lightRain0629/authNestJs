import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListTransactionsDto } from '../dto';
import {
  ConversionResponse,
  RecordResponse,
  TransactionResponse,
} from '../responses';
import { RecordService } from './record.service';

const RECORD_INCLUDE = {
  article: { select: { id: true, name: true, kind: true, color: true } },
  account: {
    select: { id: true, name: true, kind: true, currency: true, color: true },
  },
};

/**
 * The one timeline: expenses, incomes and transfers in date order.
 *
 * They live in two tables, so a page of the merged list cannot be asked of the
 * database directly. It does not have to be: the n-th entry of a merge of two
 * sorted lists is within the first n of either, so fetching `skip + limit` from
 * each side is enough to cut an exact page, whatever the split between them.
 */
@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: ListTransactionsDto,
  ): Promise<{ items: TransactionResponse[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const need = skip + limit;
    const order = query.sortOrder ?? 'desc';

    const wantsRecords = query.kind !== 'TRANSFER';
    // A transfer has no category, so filtering by one excludes them all.
    const wantsTransfers =
      (query.kind === undefined || query.kind === 'TRANSFER') &&
      !query.articleId;

    const recordWhere = this.recordWhere(userId, query);
    const transferWhere = this.transferWhere(userId, query);

    const [records, transfers, recordCount, transferCount] = await Promise.all([
      wantsRecords
        ? this.prisma.financeRecord.findMany({
            where: recordWhere,
            orderBy: [{ operationDate: order }, { createdAt: 'desc' }],
            take: need,
            include: RECORD_INCLUDE,
          })
        : Promise.resolve([]),
      wantsTransfers
        ? this.prisma.currencyConversion.findMany({
            where: transferWhere,
            orderBy: [{ operationDate: order }, { createdAt: 'desc' }],
            take: need,
          })
        : Promise.resolve([]),
      wantsRecords
        ? this.prisma.financeRecord.count({ where: recordWhere })
        : Promise.resolve(0),
      wantsTransfers
        ? this.prisma.currencyConversion.count({ where: transferWhere })
        : Promise.resolve(0),
    ]);

    const merged: Array<{
      sortKey: [number, number];
      entry: TransactionResponse;
    }> = [
      ...records.map((record) => ({
        sortKey: [
          record.operationDate.getTime(),
          record.createdAt.getTime(),
        ] as [number, number],
        entry: new TransactionResponse({
          kind: record.type,
          record: new RecordResponse(record),
        }),
      })),
      ...transfers.map((transfer) => ({
        sortKey: [
          transfer.operationDate.getTime(),
          transfer.createdAt.getTime(),
        ] as [number, number],
        entry: new TransactionResponse({
          kind: 'TRANSFER' as const,
          transfer: new ConversionResponse(transfer),
        }),
      })),
    ];

    const direction = order === 'asc' ? 1 : -1;
    merged.sort((a, b) => {
      if (a.sortKey[0] !== b.sortKey[0]) {
        return (a.sortKey[0] - b.sortKey[0]) * direction;
      }
      // Ties break newest-first either way, matching the single-table lists.
      return b.sortKey[1] - a.sortKey[1];
    });

    return {
      items: merged.slice(skip, skip + limit).map((row) => row.entry),
      total: recordCount + transferCount,
    };
  }

  private dateRange(
    query: ListTransactionsDto,
  ): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) return undefined;
    return {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  private recordWhere(
    userId: string,
    query: ListTransactionsDto,
  ): Prisma.FinanceRecordWhereInput {
    const operationDate = this.dateRange(query);
    const amount = query.search
      ? RecordService.parseAmountQuery(query.search)
      : null;

    return {
      userId,
      ...(query.kind === 'INCOME' || query.kind === 'EXPENSE'
        ? { type: query.kind }
        : {}),
      ...(query.currency ? { currency: query.currency.toUpperCase() } : {}),
      ...(query.articleId ? { articleId: query.articleId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(operationDate ? { operationDate } : {}),
      ...(query.search
        ? {
            OR: [
              { remark: { contains: query.search, mode: 'insensitive' } },
              {
                article: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              ...(amount ? [{ amount }] : []),
            ],
          }
        : {}),
    };
  }

  /**
   * A transfer touches two accounts and two currencies, and the timeline shows
   * it from both ends — so an account filter matches either side rather than
   * hiding half the money that moved through it.
   */
  private transferWhere(
    userId: string,
    query: ListTransactionsDto,
  ): Prisma.CurrencyConversionWhereInput {
    const operationDate = this.dateRange(query);
    const currency = query.currency?.toUpperCase();

    // Each clause is its own OR-group, and they have to hold together, so they
    // accumulate into one AND rather than each claiming the key.
    const and: Prisma.CurrencyConversionWhereInput[] = [];

    if (currency) {
      and.push({
        OR: [{ fromCurrency: currency }, { toCurrency: currency }],
      });
    }

    if (query.accountId) {
      and.push({
        OR: [
          { fromAccountId: query.accountId },
          { toAccountId: query.accountId },
        ],
      });
    }

    if (query.search) {
      const amount = RecordService.parseAmountQuery(query.search);
      and.push({
        OR: [
          { remark: { contains: query.search, mode: 'insensitive' } },
          ...(amount ? [{ fromAmount: amount }, { toAmount: amount }] : []),
        ],
      });
    }

    return {
      userId,
      ...(operationDate ? { operationDate } : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }
}
