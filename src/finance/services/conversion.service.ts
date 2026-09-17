import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateConversionDto,
  ListConversionsDto,
  UpdateConversionDto,
} from '../dto';
import { CurrencyConversion, Prisma } from '@prisma/client';
import { RateService } from './rate.service';
import { AccountService } from './account.service';

@Injectable()
export class ConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateService: RateService,
    private readonly accountService: AccountService,
  ) {}

  async create(
    userId: string,
    dto: CreateConversionDto,
  ): Promise<CurrencyConversion> {
    const fromCurrency = dto.fromCurrency.toUpperCase();
    const toCurrency = dto.toCurrency.toUpperCase();
    const operationDate = new Date(dto.operationDate);

    if (dto.fromAccountId) {
      await this.accountService.assertAccountUsable(
        dto.fromAccountId,
        userId,
        fromCurrency,
      );
    }
    if (dto.toAccountId) {
      await this.accountService.assertAccountUsable(
        dto.toAccountId,
        userId,
        toCurrency,
      );
    }
    if (
      dto.fromAccountId &&
      dto.toAccountId &&
      dto.fromAccountId === dto.toAccountId
    ) {
      throw new UnprocessableEntityException(
        'A transfer needs two different accounts',
      );
    }

    const fromAmount = new Prisma.Decimal(dto.fromAmount);
    const booking = await this.resolveRate(
      userId,
      fromCurrency,
      toCurrency,
      operationDate,
      dto.rate,
    );

    return this.prisma.currencyConversion.create({
      data: {
        userId,
        fromAmount,
        fromCurrency,
        toAmount: fromAmount.mul(booking.rate),
        toCurrency,
        rateUsed: booking.rate,
        rateId: booking.rateId,
        isCustomRate: booking.isCustomRate,
        fromAccountId: dto.fromAccountId ?? null,
        toAccountId: dto.toAccountId ?? null,
        feeAmount: dto.feeAmount ? new Prisma.Decimal(dto.feeAmount) : null,
        feeCurrency: dto.feeCurrency?.toUpperCase() ?? null,
        remark: dto.remark ?? null,
        operationDate,
      },
    });
  }

  /**
   * Decide what rate a conversion books at. A caller-supplied rate wins over
   * the table — that is the whole point of the override — and is flagged so the
   * null `rateId` reads as deliberate rather than as a deleted rate.
   */
  private async resolveRate(
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    operationDate: Date,
    customRate?: string | null,
  ): Promise<{
    rate: Prisma.Decimal;
    rateId: string | null;
    isCustomRate: boolean;
  }> {
    // Moving money between accounts of the same currency needs no FX rate.
    if (fromCurrency === toCurrency) {
      if (
        customRate !== undefined &&
        customRate !== null &&
        !new Prisma.Decimal(customRate).equals(1)
      ) {
        throw new UnprocessableEntityException(
          'A same-currency transfer always books at rate 1',
        );
      }
      return { rate: new Prisma.Decimal(1), rateId: null, isCustomRate: false };
    }

    if (customRate !== undefined && customRate !== null) {
      const rate = new Prisma.Decimal(customRate);
      if (rate.lessThanOrEqualTo(0)) {
        throw new UnprocessableEntityException(
          'Rate must be greater than zero',
        );
      }
      return { rate, rateId: null, isCustomRate: true };
    }

    try {
      const lookup = await this.rateService.findRateForDate(
        userId,
        fromCurrency,
        toCurrency,
        operationDate,
      );
      return {
        rate: new Prisma.Decimal(lookup.effectiveRate),
        rateId: lookup.rate.id,
        isCustomRate: false,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnprocessableEntityException(
          `No FX rate found for ${fromCurrency}/${toCurrency} at ${operationDate.toISOString()}. ` +
            'Add a rate for that date, or send an explicit `rate` to book this transfer at your own.',
        );
      }
      throw error;
    }
  }

  /**
   * Correcting a transfer is a re-booking: the amounts, the currencies, the
   * accounts and the rate all have to agree afterwards, so every field is
   * recomputed from the merged state rather than patched in isolation.
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateConversionDto,
  ): Promise<CurrencyConversion> {
    const existing = await this.findOne(id, userId);

    const fromCurrency = (
      dto.fromCurrency ?? existing.fromCurrency
    ).toUpperCase();
    const toCurrency = (dto.toCurrency ?? existing.toCurrency).toUpperCase();
    const operationDate =
      dto.operationDate !== undefined
        ? new Date(dto.operationDate)
        : existing.operationDate;
    const fromAmount =
      dto.fromAmount !== undefined
        ? new Prisma.Decimal(dto.fromAmount)
        : existing.fromAmount;

    // `null` clears the side; `undefined` leaves it as it was.
    const fromAccountId =
      dto.fromAccountId !== undefined
        ? dto.fromAccountId ?? null
        : existing.fromAccountId;
    const toAccountId =
      dto.toAccountId !== undefined
        ? dto.toAccountId ?? null
        : existing.toAccountId;

    if (fromAccountId) {
      await this.accountService.assertAccountUsable(
        fromAccountId,
        userId,
        fromCurrency,
      );
    }
    if (toAccountId) {
      await this.accountService.assertAccountUsable(
        toAccountId,
        userId,
        toCurrency,
      );
    }
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      throw new UnprocessableEntityException(
        'A transfer needs two different accounts',
      );
    }

    const booking = await this.resolveRateForUpdate(
      userId,
      existing,
      fromCurrency,
      toCurrency,
      operationDate,
      dto.rate,
    );

    const feeAmount =
      dto.feeAmount !== undefined
        ? dto.feeAmount
          ? new Prisma.Decimal(dto.feeAmount)
          : null
        : existing.feeAmount;
    const feeCurrency =
      dto.feeCurrency !== undefined
        ? dto.feeCurrency?.toUpperCase() ?? null
        : existing.feeCurrency;

    return this.prisma.currencyConversion.update({
      where: { id },
      data: {
        fromAmount,
        fromCurrency,
        toAmount: fromAmount.mul(booking.rate),
        toCurrency,
        rateUsed: booking.rate,
        rateId: booking.rateId,
        isCustomRate: booking.isCustomRate,
        fromAccountId,
        toAccountId,
        feeAmount,
        feeCurrency,
        remark: dto.remark !== undefined ? dto.remark ?? null : existing.remark,
        operationDate,
      },
    });
  }

  /**
   * An edit must not silently re-rate a transfer that was booked at a rate the
   * user typed. So a custom rate survives any edit that leaves the pair alone;
   * change a currency, or send a new `rate`, to re-rate it deliberately.
   */
  private async resolveRateForUpdate(
    userId: string,
    existing: CurrencyConversion,
    fromCurrency: string,
    toCurrency: string,
    operationDate: Date,
    customRate?: string | null,
  ): Promise<{
    rate: Prisma.Decimal;
    rateId: string | null;
    isCustomRate: boolean;
  }> {
    const pairUnchanged =
      fromCurrency === existing.fromCurrency &&
      toCurrency === existing.toCurrency;

    if (
      customRate === undefined &&
      existing.isCustomRate &&
      pairUnchanged &&
      fromCurrency !== toCurrency
    ) {
      return {
        rate: existing.rateUsed,
        rateId: null,
        isCustomRate: true,
      };
    }

    // null asked for the table rate back, so it must not fall through as a
    // custom rate of its own.
    return this.resolveRate(
      userId,
      fromCurrency,
      toCurrency,
      operationDate,
      customRate ?? undefined,
    );
  }

  async findAll(
    userId: string,
    query: ListConversionsDto,
  ): Promise<{ items: CurrencyConversion[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CurrencyConversionWhereInput = {
      userId,
      ...(query.fromCurrency
        ? { fromCurrency: query.fromCurrency.toUpperCase() }
        : {}),
      ...(query.toCurrency
        ? { toCurrency: query.toCurrency.toUpperCase() }
        : {}),
      ...(query.from || query.to
        ? {
            operationDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.currencyConversion.findMany({
        where,
        orderBy: [{ operationDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.currencyConversion.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string, userId: string): Promise<CurrencyConversion> {
    const conversion = await this.prisma.currencyConversion.findFirst({
      where: { id, userId },
    });

    if (!conversion) {
      throw new NotFoundException('Conversion not found');
    }

    return conversion;
  }

  async remove(id: string, userId: string): Promise<CurrencyConversion> {
    await this.findOne(id, userId);

    return this.prisma.currencyConversion.delete({
      where: { id },
    });
  }
}
