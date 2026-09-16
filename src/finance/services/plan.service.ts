import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FinancePlan,
  FinancePlanKind,
  FinancePlanPeriod,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePlanDto,
  UpdatePlanDto,
  ListPlansDto,
  PlanProgressDto,
} from '../dto';
import { PlanResponse, PlanProgressResponse } from '../responses';
import { AccountService } from './account.service';
import { RateService } from './rate.service';

const ZERO = new Prisma.Decimal(0);

/** How many of a plan's periods fit in the window being reported on. */
function periodsInWindow(
  period: FinancePlanPeriod,
  from: Date,
  to: Date,
): number {
  if (period === FinancePlanPeriod.CUSTOM) return 1;

  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    // A window ending mid-month still covers that month.
    1;

  const perPeriod =
    period === FinancePlanPeriod.MONTH
      ? 1
      : period === FinancePlanPeriod.QUARTER
        ? 3
        : 12;

  return Math.max(1, months / perPeriod);
}

@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateService: RateService,
    private readonly accountService: AccountService,
  ) {}

  // ============ CRUD ============

  async create(userId: string, dto: CreatePlanDto): Promise<FinancePlan> {
    this.assertShape(
      dto.kind,
      dto.articleId,
      dto.accountId,
      dto.period,
      dto.endDate,
    );
    await this.assertRelationsOwned(userId, dto.articleId, dto.accountId);

    return this.prisma.financePlan.create({
      data: {
        userId,
        kind: dto.kind,
        name: dto.name.trim(),
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency.toUpperCase(),
        period: dto.period,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        articleId: dto.articleId ?? null,
        accountId: dto.accountId ?? null,
      },
    });
  }

  async findAll(userId: string, query: ListPlansDto): Promise<FinancePlan[]> {
    return this.prisma.financePlan.findMany({
      where: {
        userId,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, userId: string): Promise<FinancePlan> {
    const plan = await this.prisma.financePlan.findFirst({
      where: { id, userId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdatePlanDto,
  ): Promise<FinancePlan> {
    const existing = await this.findOne(id, userId);
    const kind = dto.kind ?? existing.kind;
    const articleId =
      dto.articleId !== undefined ? dto.articleId : existing.articleId;
    const accountId =
      dto.accountId !== undefined ? dto.accountId : existing.accountId;
    const period = dto.period ?? existing.period;
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
        : existing.endDate?.toISOString() ?? undefined;

    this.assertShape(
      kind,
      articleId ?? undefined,
      accountId ?? undefined,
      period,
      endDate,
    );
    await this.assertRelationsOwned(
      userId,
      dto.articleId ?? undefined,
      dto.accountId ?? undefined,
    );

    return this.prisma.financePlan.update({
      where: { id },
      data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.amount !== undefined
          ? { amount: new Prisma.Decimal(dto.amount) }
          : {}),
        ...(dto.currency !== undefined
          ? { currency: dto.currency.toUpperCase() }
          : {}),
        ...(dto.period !== undefined ? { period: dto.period } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.articleId !== undefined
          ? { articleId: dto.articleId || null }
          : {}),
        ...(dto.accountId !== undefined
          ? { accountId: dto.accountId || null }
          : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
    });
  }

  async remove(id: string, userId: string): Promise<FinancePlan> {
    await this.findOne(id, userId);
    return this.prisma.financePlan.delete({ where: { id } });
  }

  // ============ Progress ============

  /**
   * Measures every active plan against what actually happened in the window.
   * A plan is a recurring rule, so its target is scaled to however many of its
   * periods the window spans: a monthly 500 asked about a year is 6000.
   */
  async getProgress(
    userId: string,
    query: PlanProgressDto,
  ): Promise<PlanProgressResponse[]> {
    const { from, to } = this.resolveWindow(query);
    const baseCurrency = query.baseCurrency?.toUpperCase() ?? null;

    const plans = await this.prisma.financePlan.findMany({
      where: {
        userId,
        isArchived: false,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    if (plans.length === 0) return [];

    const results: PlanProgressResponse[] = [];
    for (const plan of plans) {
      const currency = baseCurrency ?? plan.currency;
      const { actual, rateMissing } = await this.actualFor(
        userId,
        plan,
        from,
        to,
        currency,
      );

      const plannedRaw = plan.amount.mul(
        // A goal is one pot, not a per-period promise; it does not scale.
        plan.kind === FinancePlanKind.GOAL
          ? 1
          : periodsInWindow(plan.period, from, to),
      );
      const planned = await this.convert(
        userId,
        plannedRaw,
        plan.currency,
        currency,
        to,
      );

      const target = planned.value ?? plannedRaw;
      const remaining = target.sub(actual);
      const progress = target.isZero()
        ? 100
        : Math.max(
            0,
            Math.min(100, parseFloat(actual.mul(100).div(target).toFixed(2))),
          );

      results.push(
        new PlanProgressResponse({
          plan: new PlanResponse(plan),
          periodStart: from.toISOString(),
          periodEnd: to.toISOString(),
          planned: target.toFixed(2),
          actual: actual.toFixed(2),
          remaining: remaining.toFixed(2),
          progress,
          isOverBudget:
            plan.kind === FinancePlanKind.LIMIT && remaining.lessThan(0),
          isAchieved:
            plan.kind !== FinancePlanKind.LIMIT &&
            actual.greaterThanOrEqualTo(target),
          rateMissing: rateMissing || planned.rateMissing,
        }),
      );
    }

    return results;
  }

  // ============ Internals ============

  private resolveWindow(query: PlanProgressDto): { from: Date; to: Date } {
    if (query.from && query.to) {
      return { from: new Date(query.from), to: new Date(query.to) };
    }
    const now = new Date();
    return {
      from: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
      ),
      to: new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }

  /** What actually happened, in the reporting currency. */
  private async actualFor(
    userId: string,
    plan: FinancePlan,
    from: Date,
    to: Date,
    currency: string,
  ): Promise<{ actual: Prisma.Decimal; rateMissing: boolean }> {
    if (plan.kind === FinancePlanKind.GOAL) {
      // A goal measures the pot itself, not the flow into it.
      if (!plan.accountId) return { actual: ZERO, rateMissing: false };
      const balances = await this.accountBalance(userId, plan.accountId, to);
      const converted = await this.convert(
        userId,
        balances.balance,
        balances.currency,
        currency,
        to,
      );
      return {
        actual: converted.value ?? ZERO,
        rateMissing: converted.rateMissing,
      };
    }

    const grouped = await this.prisma.financeRecord.groupBy({
      by: ['currency', 'type'],
      where: {
        userId,
        operationDate: { gte: from, lte: to },
        ...(plan.kind === FinancePlanKind.LIMIT
          ? { type: 'EXPENSE' as const, articleId: plan.articleId }
          : {}),
      },
      _sum: { amount: true },
    });

    let total = ZERO;
    let rateMissing = false;
    for (const row of grouped) {
      const converted = await this.convert(
        userId,
        row._sum.amount ?? ZERO,
        row.currency,
        currency,
        to,
      );
      if (converted.value === null) {
        rateMissing = true;
        continue;
      }
      // A limit counts spending; a saving target counts income minus spending.
      total =
        plan.kind === FinancePlanKind.LIMIT || row.type === 'INCOME'
          ? total.add(converted.value)
          : total.sub(converted.value);
    }

    return { actual: total, rateMissing };
  }

  private async accountBalance(
    userId: string,
    accountId: string,
    asOf: Date,
  ): Promise<{ balance: Prisma.Decimal; currency: string }> {
    const balances = await this.accountService.getBalances(userId, {
      asOf: asOf.toISOString(),
      includeArchived: true,
    });
    const entry = balances.accounts.find((a) => a.account.id === accountId);
    if (!entry) return { balance: ZERO, currency: 'USD' };

    return {
      balance: new Prisma.Decimal(entry.balance),
      currency: entry.account.currency,
    };
  }

  private async convert(
    userId: string,
    amount: Prisma.Decimal,
    from: string,
    to: string,
    asOf: Date,
  ): Promise<{ value: Prisma.Decimal | null; rateMissing: boolean }> {
    if (from === to) return { value: amount, rateMissing: false };
    try {
      const lookup = await this.rateService.findNearestRateForDate(
        userId,
        from,
        to,
        asOf,
      );
      return {
        value: amount.mul(lookup.effectiveRate),
        rateMissing: false,
      };
    } catch {
      return { value: null, rateMissing: true };
    }
  }

  private assertShape(
    kind: FinancePlanKind,
    articleId: string | undefined,
    accountId: string | undefined,
    period: FinancePlanPeriod,
    endDate: string | undefined,
  ): void {
    if (kind === FinancePlanKind.LIMIT && !articleId) {
      throw new UnprocessableEntityException(
        'A spending limit needs a category to cap',
      );
    }
    if (kind === FinancePlanKind.GOAL && !accountId) {
      throw new UnprocessableEntityException(
        'A savings goal needs an account to fill',
      );
    }
    if (period === FinancePlanPeriod.CUSTOM && !endDate) {
      throw new UnprocessableEntityException(
        'A custom period needs an end date',
      );
    }
  }

  private async assertRelationsOwned(
    userId: string,
    articleId: string | undefined,
    accountId: string | undefined,
  ): Promise<void> {
    if (articleId) {
      const article = await this.prisma.financeArticle.findFirst({
        where: { id: articleId, userId },
      });
      if (!article) throw new NotFoundException('Category not found');
    }
    if (accountId) {
      const account = await this.prisma.financeAccount.findFirst({
        where: { id: accountId, userId },
      });
      if (!account) throw new NotFoundException('Account not found');
    }
  }
}
