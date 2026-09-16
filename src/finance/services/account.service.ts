import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FinanceAccount,
  FinanceAccountKind,
  FinanceAccountValuation,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BalancesDto,
  CreateAccountDto,
  CreateValuationDto,
  ListAccountsDto,
  NetWorthHistoryDto,
  NetWorthInterval,
  UpdateAccountDto,
} from '../dto';
import {
  AccountBalance,
  AccountResponse,
  BalancesResponse,
  DebtsResponse,
  DebtSummaryItem,
  KindBreakdown,
  MissingRate,
  NetWorthHistoryResponse,
  NetWorthPoint,
  ValuationResponse,
} from '../responses';
import { RateService } from './rate.service';

/** Kinds that represent money owed rather than money held. */
const LIABILITY_KINDS: FinanceAccountKind[] = ['LOAN', 'CREDIT_CARD'];

const ZERO = new Prisma.Decimal(0);

type BalanceEvent = { at: Date; delta: Prisma.Decimal };

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateService: RateService,
  ) {}

  static isLiability(kind: FinanceAccountKind): boolean {
    return LIABILITY_KINDS.includes(kind);
  }

  // ============ CRUD ============

  async create(userId: string, dto: CreateAccountDto): Promise<FinanceAccount> {
    const existing = await this.prisma.financeAccount.findFirst({
      where: { userId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `An account named "${dto.name}" already exists`,
      );
    }

    return this.prisma.financeAccount.create({
      data: {
        userId,
        name: dto.name,
        kind: dto.kind,
        valuationMode: dto.valuationMode ?? 'TRACKED',
        currency: dto.currency.toUpperCase(),
        openingBalance: new Prisma.Decimal(dto.openingBalance ?? '0'),
        openingDate: dto.openingDate ? new Date(dto.openingDate) : new Date(),
        institution: dto.institution ?? null,
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        counterparty: dto.counterparty ?? null,
        creditLimit: dto.creditLimit
          ? new Prisma.Decimal(dto.creditLimit)
          : null,
        interestRate: dto.interestRate
          ? new Prisma.Decimal(dto.interestRate)
          : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        excludeFromNetWorth: dto.excludeFromNetWorth ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAll(
    userId: string,
    query: ListAccountsDto,
  ): Promise<FinanceAccount[]> {
    return this.prisma.financeAccount.findMany({
      where: {
        userId,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, userId: string): Promise<FinanceAccount> {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAccountDto,
  ): Promise<FinanceAccount> {
    await this.findOne(id, userId);

    if (dto.name) {
      const clash = await this.prisma.financeAccount.findFirst({
        where: { userId, name: dto.name, id: { not: id } },
      });
      if (clash) {
        throw new ConflictException(
          `An account named "${dto.name}" already exists`,
        );
      }
    }

    const data: Prisma.FinanceAccountUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.valuationMode !== undefined) data.valuationMode = dto.valuationMode;
    if (dto.openingBalance !== undefined)
      data.openingBalance = new Prisma.Decimal(dto.openingBalance);
    if (dto.openingDate !== undefined)
      data.openingDate = new Date(dto.openingDate);
    if (dto.institution !== undefined) data.institution = dto.institution;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.counterparty !== undefined) data.counterparty = dto.counterparty;
    if (dto.creditLimit !== undefined)
      data.creditLimit = dto.creditLimit
        ? new Prisma.Decimal(dto.creditLimit)
        : null;
    if (dto.interestRate !== undefined)
      data.interestRate = dto.interestRate
        ? new Prisma.Decimal(dto.interestRate)
        : null;
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.excludeFromNetWorth !== undefined)
      data.excludeFromNetWorth = dto.excludeFromNetWorth;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

    return this.prisma.financeAccount.update({ where: { id }, data });
  }

  /**
   * Archives an account that still carries history so balances stay reproducible;
   * only a completely unused account is deleted outright.
   */
  async remove(id: string, userId: string): Promise<FinanceAccount> {
    const account = await this.findOne(id, userId);

    const [recordCount, transferCount] = await this.prisma.$transaction([
      this.prisma.financeRecord.count({ where: { accountId: id } }),
      this.prisma.currencyConversion.count({
        where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
      }),
    ]);

    if (recordCount > 0 || transferCount > 0) {
      return this.prisma.financeAccount.update({
        where: { id },
        data: { isArchived: true },
      });
    }

    return this.prisma.financeAccount.delete({ where: { id: account.id } });
  }

  /**
   * Guards that a record or transfer leg lines up with the account it touches.
   * Balances are only meaningful when every movement is in the account currency.
   */
  async assertAccountUsable(
    accountId: string,
    userId: string,
    currency: string,
  ): Promise<FinanceAccount> {
    const account = await this.findOne(accountId, userId);

    if (account.currency !== currency.toUpperCase()) {
      throw new UnprocessableEntityException(
        `Account "${account.name}" holds ${account.currency}; ` +
          `record a transfer instead of a ${currency.toUpperCase()} entry`,
      );
    }

    if (account.valuationMode === 'VALUED') {
      throw new UnprocessableEntityException(
        `Account "${account.name}" is valuation-based; update its value instead of adding entries`,
      );
    }

    return account;
  }

  // ============ Valuations ============

  async addValuation(
    accountId: string,
    userId: string,
    dto: CreateValuationDto,
  ): Promise<FinanceAccountValuation> {
    const account = await this.findOne(accountId, userId);
    if (account.valuationMode !== 'VALUED') {
      throw new BadRequestException(
        `Account "${account.name}" derives its balance from records; switch it to VALUED to set a value directly`,
      );
    }

    return this.prisma.financeAccountValuation.create({
      data: {
        userId,
        accountId,
        value: new Prisma.Decimal(dto.value),
        remark: dto.remark ?? null,
        valuedAt: new Date(dto.valuedAt),
      },
    });
  }

  async listValuations(
    accountId: string,
    userId: string,
  ): Promise<FinanceAccountValuation[]> {
    await this.findOne(accountId, userId);
    return this.prisma.financeAccountValuation.findMany({
      where: { accountId, userId },
      orderBy: { valuedAt: 'desc' },
    });
  }

  async removeValuation(
    id: string,
    userId: string,
  ): Promise<FinanceAccountValuation> {
    const valuation = await this.prisma.financeAccountValuation.findFirst({
      where: { id, userId },
    });
    if (!valuation) {
      throw new NotFoundException('Valuation not found');
    }
    return this.prisma.financeAccountValuation.delete({ where: { id } });
  }
  // ============ Balances ============

  async getBalances(
    userId: string,
    query: BalancesDto,
  ): Promise<BalancesResponse> {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const baseCurrency = query.baseCurrency?.toUpperCase() ?? null;

    const accounts = await this.prisma.financeAccount.findMany({
      where: {
        userId,
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const native = await this.computeNativeBalances(userId, accounts, asOf);

    const converter = this.makeConverter(userId, baseCurrency, asOf);
    const balances: AccountBalance[] = [];
    const byCurrency: Record<string, Prisma.Decimal> = {};

    let totalAssets = ZERO;
    let totalLiabilities = ZERO;

    for (const account of accounts) {
      const balance = native.get(account.id) ?? ZERO;
      const isLiability = AccountService.isLiability(account.kind);

      byCurrency[account.currency] = (byCurrency[account.currency] ?? ZERO).add(
        balance,
      );

      const converted = await converter.convert(balance, account.currency);

      balances.push({
        account: new AccountResponse(account),
        balance: balance.toFixed(8).replace(/\.?0+$/, '') || '0',
        balanceInBase: converted.value ? converted.value.toFixed(2) : null,
        rateUsed: converted.rate ? converted.rate.toString() : null,
        rateMissing: converted.missing,
        isLiability,
      });

      if (account.excludeFromNetWorth || converted.value === null) continue;

      if (isLiability) {
        // A loan balance is negative while money is owed; report it as a positive debt.
        totalLiabilities = totalLiabilities.add(converted.value.neg());
      } else {
        totalAssets = totalAssets.add(converted.value);
      }
    }

    const byKind = this.buildKindBreakdown(accounts, balances, totalAssets);

    return new BalancesResponse({
      accounts: balances,
      baseCurrency,
      asOf,
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      netWorth: totalAssets.sub(totalLiabilities).toFixed(2),
      byKind,
      byCurrency: Object.fromEntries(
        Object.entries(byCurrency).map(([c, v]) => [c, v.toString()]),
      ),
      missingRates: converter.missingRates(),
    });
  }

  private buildKindBreakdown(
    accounts: FinanceAccount[],
    balances: AccountBalance[],
    totalAssets: Prisma.Decimal,
  ): KindBreakdown[] {
    const byKind = new Map<
      FinanceAccountKind,
      { total: Prisma.Decimal; count: number }
    >();

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const converted = balances[i].balanceInBase;
      if (account.excludeFromNetWorth || converted === null) continue;

      const entry = byKind.get(account.kind) ?? { total: ZERO, count: 0 };
      entry.total = entry.total.add(new Prisma.Decimal(converted));
      entry.count += 1;
      byKind.set(account.kind, entry);
    }

    return Array.from(byKind.entries())
      .map(([kind, { total, count }]) => ({
        kind,
        total: total.toFixed(2),
        percentage: totalAssets.isZero()
          ? 0
          : parseFloat(total.mul(100).div(totalAssets).toFixed(2)),
        accountCount: count,
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
  }

  /**
   * Folds opening balance, records and transfers into a balance per account.
   * VALUED accounts ignore all of that and take their latest valuation instead.
   */
  private async computeNativeBalances(
    userId: string,
    accounts: FinanceAccount[],
    asOf: Date,
  ): Promise<Map<string, Prisma.Decimal>> {
    const balances = new Map<string, Prisma.Decimal>();
    if (accounts.length === 0) return balances;

    const ids = accounts.map((a) => a.id);
    const tracked = accounts.filter(
      (a) => a.valuationMode === 'TRACKED' && a.openingDate <= asOf,
    );
    const trackedIds = tracked.map((a) => a.id);

    for (const account of accounts) {
      balances.set(
        account.id,
        account.openingDate <= asOf ? account.openingBalance : ZERO,
      );
    }

    if (trackedIds.length > 0) {
      const [recordSums, outgoing, incoming] = await Promise.all([
        this.prisma.financeRecord.groupBy({
          by: ['accountId', 'type'],
          where: {
            userId,
            accountId: { in: trackedIds },
            operationDate: { lte: asOf },
          },
          _sum: { amount: true },
        }),
        this.prisma.currencyConversion.groupBy({
          by: ['fromAccountId'],
          where: {
            userId,
            fromAccountId: { in: trackedIds },
            operationDate: { lte: asOf },
          },
          _sum: { fromAmount: true },
        }),
        this.prisma.currencyConversion.groupBy({
          by: ['toAccountId'],
          where: {
            userId,
            toAccountId: { in: trackedIds },
            operationDate: { lte: asOf },
          },
          _sum: { toAmount: true },
        }),
      ]);

      for (const row of recordSums) {
        if (!row.accountId) continue;
        const current = balances.get(row.accountId) ?? ZERO;
        const amount = row._sum.amount ?? ZERO;
        balances.set(
          row.accountId,
          row.type === 'INCOME' ? current.add(amount) : current.sub(amount),
        );
      }

      for (const row of outgoing) {
        if (!row.fromAccountId) continue;
        const current = balances.get(row.fromAccountId) ?? ZERO;
        balances.set(
          row.fromAccountId,
          current.sub(row._sum.fromAmount ?? ZERO),
        );
      }

      for (const row of incoming) {
        if (!row.toAccountId) continue;
        const current = balances.get(row.toAccountId) ?? ZERO;
        balances.set(row.toAccountId, current.add(row._sum.toAmount ?? ZERO));
      }

      // Transfer fees come out of the source account, but only when the fee is
      // denominated in that account own currency.
      const fees = await this.prisma.currencyConversion.findMany({
        where: {
          userId,
          fromAccountId: { in: trackedIds },
          operationDate: { lte: asOf },
          feeAmount: { not: null },
        },
        select: { fromAccountId: true, feeAmount: true, feeCurrency: true },
      });

      const currencyById = new Map(accounts.map((a) => [a.id, a.currency]));
      for (const fee of fees) {
        if (!fee.fromAccountId || !fee.feeAmount) continue;
        if (
          fee.feeCurrency &&
          fee.feeCurrency !== currencyById.get(fee.fromAccountId)
        ) {
          continue;
        }
        const current = balances.get(fee.fromAccountId) ?? ZERO;
        balances.set(fee.fromAccountId, current.sub(fee.feeAmount));
      }
    }

    const valuedIds = accounts
      .filter((a) => a.valuationMode === 'VALUED')
      .map((a) => a.id);

    if (valuedIds.length > 0) {
      const valuations = await this.prisma.financeAccountValuation.findMany({
        where: {
          userId,
          accountId: { in: valuedIds },
          valuedAt: { lte: asOf },
        },
        orderBy: { valuedAt: 'desc' },
      });

      const seen = new Set<string>();
      for (const valuation of valuations) {
        if (seen.has(valuation.accountId)) continue;
        seen.add(valuation.accountId);
        balances.set(valuation.accountId, valuation.value);
      }
    }

    void ids;
    return balances;
  }

  /**
   * Converts into the base currency, remembering pairs that have no rate on
   * file so callers can tell "zero" apart from "unknown".
   */
  private makeConverter(
    userId: string,
    baseCurrency: string | null,
    defaultAsOf: Date,
  ) {
    const rateCache = new Map<string, Prisma.Decimal | null>();
    const missing = new Map<string, MissingRate>();

    const rateFor = async (
      currency: string,
      asOf: Date,
    ): Promise<Prisma.Decimal | null> => {
      if (!baseCurrency || currency === baseCurrency)
        return new Prisma.Decimal(1);

      const key = `${currency}|${baseCurrency}|${asOf.toISOString()}`;
      if (rateCache.has(key)) return rateCache.get(key) ?? null;

      try {
        const lookup = await this.rateService.findNearestRateForDate(
          userId,
          currency,
          baseCurrency,
          asOf,
        );
        const rate = new Prisma.Decimal(lookup.effectiveRate);
        rateCache.set(key, rate);
        return rate;
      } catch {
        this.logger.warn(
          `No ${currency}/${baseCurrency} rate on file; excluding it from totals`,
        );
        rateCache.set(key, null);
        missing.set(`${currency}|${baseCurrency}`, {
          from: currency,
          to: baseCurrency,
        });
        return null;
      }
    };

    return {
      async convert(
        amount: Prisma.Decimal,
        currency: string,
        asOf: Date = defaultAsOf,
      ): Promise<{
        value: Prisma.Decimal | null;
        rate: Prisma.Decimal | null;
        missing: boolean;
      }> {
        if (!baseCurrency) {
          return { value: null, rate: null, missing: false };
        }
        const rate = await rateFor(currency, asOf);
        if (rate === null) {
          return { value: null, rate: null, missing: true };
        }
        return { value: amount.mul(rate), rate, missing: false };
      },
      missingRates: (): MissingRate[] => Array.from(missing.values()),
    };
  }
  // ============ Net worth over time ============

  async getNetWorthHistory(
    userId: string,
    query: NetWorthHistoryDto,
  ): Promise<NetWorthHistoryResponse> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const interval = query.interval ?? 'month';
    const baseCurrency = query.baseCurrency?.toUpperCase() ?? 'USD';

    if (from > to) {
      throw new BadRequestException('"from" must be before "to"');
    }

    const boundaries = this.periodBoundaries(from, to, interval);

    const accounts = await this.prisma.financeAccount.findMany({
      where: { userId, excludeFromNetWorth: false },
    });

    if (accounts.length === 0) {
      return new NetWorthHistoryResponse({
        points: boundaries.map((date) => ({
          date: date.toISOString(),
          assets: '0.00',
          liabilities: '0.00',
          netWorth: '0.00',
        })),
        baseCurrency,
        change: '0.00',
        changePercent: null,
        missingRates: [],
      });
    }

    const events = await this.loadBalanceEvents(userId, accounts, to);
    const converter = this.makeConverter(userId, baseCurrency, to);
    const points: NetWorthPoint[] = [];

    for (const boundary of boundaries) {
      let assets = ZERO;
      let liabilities = ZERO;

      for (const account of accounts) {
        const balance = this.balanceAt(account, events, boundary);
        const converted = await converter.convert(
          balance,
          account.currency,
          boundary,
        );
        if (converted.value === null) continue;

        if (AccountService.isLiability(account.kind)) {
          liabilities = liabilities.add(converted.value.neg());
        } else {
          assets = assets.add(converted.value);
        }
      }

      points.push({
        date: boundary.toISOString(),
        assets: assets.toFixed(2),
        liabilities: liabilities.toFixed(2),
        netWorth: assets.sub(liabilities).toFixed(2),
      });
    }

    const first = points.length ? new Prisma.Decimal(points[0].netWorth) : ZERO;
    const last = points.length
      ? new Prisma.Decimal(points[points.length - 1].netWorth)
      : ZERO;
    const change = last.sub(first);

    return new NetWorthHistoryResponse({
      points,
      baseCurrency,
      change: change.toFixed(2),
      changePercent: first.isZero()
        ? null
        : parseFloat(change.mul(100).div(first.abs()).toFixed(2)),
      missingRates: converter.missingRates(),
    });
  }

  /**
   * Pulls every balance-moving event once, so a 12-point history costs the same
   * number of queries as a single balance lookup.
   */
  private async loadBalanceEvents(
    userId: string,
    accounts: FinanceAccount[],
    until: Date,
  ): Promise<Map<string, BalanceEvent[]>> {
    const ids = accounts.map((a) => a.id);
    const currencyById = new Map(accounts.map((a) => [a.id, a.currency]));
    const byAccount = new Map<string, BalanceEvent[]>();
    const push = (accountId: string, at: Date, delta: Prisma.Decimal) => {
      const list = byAccount.get(accountId) ?? [];
      list.push({ at, delta });
      byAccount.set(accountId, list);
    };

    const [records, transfers, valuations] = await this.prisma.$transaction([
      this.prisma.financeRecord.findMany({
        where: {
          userId,
          accountId: { in: ids },
          operationDate: { lte: until },
        },
        select: {
          accountId: true,
          type: true,
          amount: true,
          operationDate: true,
        },
        orderBy: { operationDate: 'asc' },
      }),
      this.prisma.currencyConversion.findMany({
        where: {
          userId,
          operationDate: { lte: until },
          OR: [{ fromAccountId: { in: ids } }, { toAccountId: { in: ids } }],
        },
        select: {
          fromAccountId: true,
          toAccountId: true,
          fromAmount: true,
          toAmount: true,
          feeAmount: true,
          feeCurrency: true,
          operationDate: true,
        },
        orderBy: { operationDate: 'asc' },
      }),
      this.prisma.financeAccountValuation.findMany({
        where: { userId, accountId: { in: ids }, valuedAt: { lte: until } },
        select: { accountId: true, value: true, valuedAt: true },
        orderBy: { valuedAt: 'asc' },
      }),
    ]);

    for (const record of records) {
      if (!record.accountId) continue;
      push(
        record.accountId,
        record.operationDate,
        record.type === 'INCOME' ? record.amount : record.amount.neg(),
      );
    }

    for (const transfer of transfers) {
      if (transfer.fromAccountId) {
        push(
          transfer.fromAccountId,
          transfer.operationDate,
          transfer.fromAmount.neg(),
        );
        if (
          transfer.feeAmount &&
          (!transfer.feeCurrency ||
            transfer.feeCurrency === currencyById.get(transfer.fromAccountId))
        ) {
          push(
            transfer.fromAccountId,
            transfer.operationDate,
            transfer.feeAmount.neg(),
          );
        }
      }
      if (transfer.toAccountId) {
        push(transfer.toAccountId, transfer.operationDate, transfer.toAmount);
      }
    }

    // Valuations replace rather than add, so they are kept on a separate track.
    for (const valuation of valuations) {
      const key = `valuation:${valuation.accountId}`;
      const list = byAccount.get(key) ?? [];
      list.push({ at: valuation.valuedAt, delta: valuation.value });
      byAccount.set(key, list);
    }

    for (const list of byAccount.values()) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    return byAccount;
  }

  private balanceAt(
    account: FinanceAccount,
    events: Map<string, BalanceEvent[]>,
    at: Date,
  ): Prisma.Decimal {
    if (account.openingDate > at) return ZERO;

    if (account.valuationMode === 'VALUED') {
      const valuations = events.get(`valuation:${account.id}`) ?? [];
      let value = account.openingBalance;
      for (const valuation of valuations) {
        if (valuation.at > at) break;
        value = valuation.delta;
      }
      return value;
    }

    let balance = account.openingBalance;
    for (const event of events.get(account.id) ?? []) {
      if (event.at > at) break;
      balance = balance.add(event.delta);
    }
    return balance;
  }

  private periodBoundaries(
    from: Date,
    to: Date,
    interval: NetWorthInterval,
  ): Date[] {
    const boundaries: Date[] = [];
    const cursor = new Date(from);
    const limit = 400; // guards against a day-interval request spanning years

    while (cursor <= to && boundaries.length < limit) {
      let end: Date;
      if (interval === 'day') {
        end = new Date(cursor);
        end.setHours(23, 59, 59, 999);
        cursor.setDate(cursor.getDate() + 1);
      } else if (interval === 'week') {
        end = new Date(cursor);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        cursor.setDate(cursor.getDate() + 7);
      } else {
        end = new Date(
          cursor.getFullYear(),
          cursor.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        cursor.setMonth(cursor.getMonth() + 1, 1);
      }
      boundaries.push(end > to ? new Date(to) : end);
    }

    if (boundaries.length === 0) boundaries.push(new Date(to));
    return boundaries;
  }

  // ============ Debts ============

  async getDebts(userId: string, query: BalancesDto): Promise<DebtsResponse> {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const baseCurrency = query.baseCurrency?.toUpperCase() ?? null;

    const accounts = await this.prisma.financeAccount.findMany({
      where: {
        userId,
        kind: { in: ['LOAN', 'CREDIT_CARD', 'RECEIVABLE'] },
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ dueDate: 'asc' }, { name: 'asc' }],
    });

    const owed: DebtSummaryItem[] = [];
    const lent: DebtSummaryItem[] = [];

    if (accounts.length === 0) {
      return new DebtsResponse({
        owed,
        lent,
        totalOwed: ZERO.toFixed(2),
        totalLent: ZERO.toFixed(2),
        baseCurrency,
      });
    }

    const native = await this.computeNativeBalances(userId, accounts, asOf);
    const converter = this.makeConverter(userId, baseCurrency, asOf);

    let totalOwed = ZERO;
    let totalLent = ZERO;

    /**
     * A repayment moves money *into* a loan but *out of* a receivable, so the
     * two run off opposite legs of the transfer. Querying only one direction
     * left every receivable reporting nothing repaid.
     */
    const receivableIds = accounts
      .filter((a) => !AccountService.isLiability(a.kind))
      .map((a) => a.id);
    const liabilityIds = accounts
      .filter((a) => AccountService.isLiability(a.kind))
      .map((a) => a.id);

    const [paidBackToYou, paidIntoDebt, recordSums] = await Promise.all([
      this.prisma.currencyConversion.groupBy({
        by: ['fromAccountId'],
        where: {
          userId,
          fromAccountId: { in: receivableIds },
          operationDate: { lte: asOf },
        },
        _sum: { fromAmount: true },
      }),
      this.prisma.currencyConversion.groupBy({
        by: ['toAccountId'],
        where: {
          userId,
          toAccountId: { in: liabilityIds },
          operationDate: { lte: asOf },
        },
        _sum: { toAmount: true },
      }),
      /**
       * A tracked balance is opening balance plus every record *and* transfer,
       * so a repayment booked as a record already moves `outstanding`. Counting
       * only transfers here left progress at 0% while the debt visibly shrank.
       */
      this.prisma.financeRecord.groupBy({
        by: ['accountId', 'type'],
        where: {
          userId,
          accountId: { in: accounts.map((a) => a.id) },
          operationDate: { lte: asOf },
        },
        _sum: { amount: true },
      }),
    ]);

    const repaidById = new Map<string, Prisma.Decimal>();
    const addRepaid = (id: string, amount: Prisma.Decimal) =>
      repaidById.set(id, (repaidById.get(id) ?? ZERO).add(amount));

    for (const row of paidBackToYou) {
      if (row.fromAccountId)
        addRepaid(row.fromAccountId, row._sum.fromAmount ?? ZERO);
    }
    for (const row of paidIntoDebt) {
      if (row.toAccountId)
        addRepaid(row.toAccountId, row._sum.toAmount ?? ZERO);
    }
    for (const row of recordSums) {
      if (!row.accountId) continue;
      // Money owed shrinks on income; money lent out shrinks on expense.
      const repaying = liabilityIds.includes(row.accountId)
        ? row.type === 'INCOME'
        : row.type === 'EXPENSE';
      if (repaying) addRepaid(row.accountId, row._sum.amount ?? ZERO);
    }

    for (const account of accounts) {
      const balance = native.get(account.id) ?? ZERO;
      const isLiability = AccountService.isLiability(account.kind);
      const outstanding = isLiability ? balance.neg() : balance;
      const repaid = repaidById.get(account.id) ?? ZERO;
      const principal = outstanding.add(repaid);
      const converted = await converter.convert(outstanding, account.currency);

      const daysUntilDue = account.dueDate
        ? Math.ceil(
            (account.dueDate.getTime() - asOf.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      const item: DebtSummaryItem = {
        account: new AccountResponse(account),
        outstanding: outstanding.toFixed(2),
        outstandingInBase: converted.value ? converted.value.toFixed(2) : null,
        repaid: repaid.toFixed(2),
        progress: principal.isZero()
          ? 100
          : Math.max(
              0,
              Math.min(
                100,
                parseFloat(repaid.mul(100).div(principal).toFixed(2)),
              ),
            ),
        daysUntilDue,
        isOverdue:
          daysUntilDue !== null &&
          daysUntilDue < 0 &&
          outstanding.greaterThan(0),
      };

      if (isLiability) {
        owed.push(item);
        if (converted.value) totalOwed = totalOwed.add(converted.value);
      } else {
        lent.push(item);
        if (converted.value) totalLent = totalLent.add(converted.value);
      }
    }

    return new DebtsResponse({
      owed,
      lent,
      totalOwed: totalOwed.toFixed(2),
      totalLent: totalLent.toFixed(2),
      baseCurrency,
    });
  }

  toValuationResponse(valuation: FinanceAccountValuation): ValuationResponse {
    return new ValuationResponse(valuation);
  }
}
