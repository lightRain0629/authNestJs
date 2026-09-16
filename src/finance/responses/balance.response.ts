import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceAccountKind } from '@prisma/client';
import { AccountResponse } from './account.response';

/** A currency pair the app could not convert because no rate exists for it. */
export class MissingRate {
  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;
}

export class AccountBalance {
  @ApiProperty({ type: AccountResponse })
  account: AccountResponse;

  @ApiProperty({ description: 'Balance in the account own currency' })
  balance: string;

  @ApiPropertyOptional({
    description: 'Balance converted into the requested base currency',
  })
  balanceInBase: string | null;

  @ApiPropertyOptional({
    description: 'Rate used for the conversion, null when no rate was found',
  })
  rateUsed: string | null;

  @ApiProperty({
    description:
      'True when the balance could not be converted for lack of a rate',
  })
  rateMissing: boolean;

  @ApiProperty({ description: 'LOAN and CREDIT_CARD count against net worth' })
  isLiability: boolean;
}

export class KindBreakdown {
  @ApiProperty({ enum: FinanceAccountKind })
  kind: FinanceAccountKind;

  @ApiProperty()
  total: string;

  @ApiProperty({ description: 'Share of total assets, 0-100' })
  percentage: number;

  @ApiProperty()
  accountCount: number;
}

export class BalancesResponse {
  @ApiProperty({ type: [AccountBalance] })
  accounts: AccountBalance[];

  @ApiPropertyOptional()
  baseCurrency: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  asOf: Date;

  @ApiProperty({
    description: 'Sum of non-liability balances in base currency',
  })
  totalAssets: string;

  @ApiProperty({ description: 'Sum of what you owe, as a positive number' })
  totalLiabilities: string;

  @ApiProperty({ description: 'totalAssets minus totalLiabilities' })
  netWorth: string;

  @ApiProperty({
    type: [KindBreakdown],
    description: 'Asset allocation by account kind',
  })
  byKind: KindBreakdown[];

  @ApiProperty({
    description: 'Totals per currency before conversion',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  byCurrency: Record<string, string>;

  @ApiProperty({
    type: [MissingRate],
    description:
      'Pairs with no rate on file. Those balances are excluded from the totals.',
  })
  missingRates: MissingRate[];

  constructor(partial: Partial<BalancesResponse>) {
    Object.assign(this, partial);
  }
}

export class NetWorthPoint {
  @ApiProperty({ description: 'Period end date, ISO' })
  date: string;

  @ApiProperty()
  assets: string;

  @ApiProperty()
  liabilities: string;

  @ApiProperty()
  netWorth: string;
}

export class NetWorthHistoryResponse {
  @ApiProperty({ type: [NetWorthPoint] })
  points: NetWorthPoint[];

  @ApiProperty()
  baseCurrency: string;

  @ApiProperty({ description: 'Absolute change across the whole window' })
  change: string;

  @ApiPropertyOptional({
    description:
      'Percent change across the window, null when starting from zero',
  })
  changePercent: number | null;

  @ApiProperty({ type: [MissingRate] })
  missingRates: MissingRate[];

  constructor(partial: Partial<NetWorthHistoryResponse>) {
    Object.assign(this, partial);
  }
}

export class DebtSummaryItem {
  @ApiProperty({ type: AccountResponse })
  account: AccountResponse;

  @ApiProperty({ description: 'Outstanding amount as a positive number' })
  outstanding: string;

  @ApiPropertyOptional()
  outstandingInBase: string | null;

  @ApiProperty({ description: 'Total repaid so far' })
  repaid: string;

  @ApiProperty({ description: 'Repayment progress 0-100' })
  progress: number;

  @ApiPropertyOptional({
    description: 'Days until dueDate, negative when overdue',
  })
  daysUntilDue: number | null;

  @ApiProperty()
  isOverdue: boolean;
}

export class DebtsResponse {
  @ApiProperty({ type: [DebtSummaryItem], description: 'Money you owe' })
  owed: DebtSummaryItem[];

  @ApiProperty({ type: [DebtSummaryItem], description: 'Money owed to you' })
  lent: DebtSummaryItem[];

  @ApiProperty()
  totalOwed: string;

  @ApiProperty()
  totalLent: string;

  @ApiPropertyOptional()
  baseCurrency: string | null;

  constructor(partial: Partial<DebtsResponse>) {
    Object.assign(this, partial);
  }
}
