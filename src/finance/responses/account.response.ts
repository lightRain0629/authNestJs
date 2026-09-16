import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinanceAccount,
  FinanceAccountKind,
  FinanceAccountValuationMode,
  Prisma,
} from '@prisma/client';
import { Exclude } from 'class-transformer';

const dec = (v: Prisma.Decimal | null | undefined): string | null =>
  v === null || v === undefined ? null : v.toString();

export class AccountResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Exclude()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: FinanceAccountKind })
  kind: FinanceAccountKind;

  @ApiProperty({ enum: FinanceAccountValuationMode })
  valuationMode: FinanceAccountValuationMode;

  @ApiProperty({ description: 'Currency or asset ticker' })
  currency: string;

  @ApiProperty({ description: 'Opening balance as string decimal' })
  openingBalance: string;

  @ApiProperty({ type: String, format: 'date-time' })
  openingDate: Date;

  @ApiPropertyOptional()
  institution: string | null;

  @ApiPropertyOptional()
  color: string | null;

  @ApiPropertyOptional()
  icon: string | null;

  @ApiPropertyOptional({ description: 'Who you owe or who owes you' })
  counterparty: string | null;

  @ApiPropertyOptional({ description: 'Credit limit as string decimal' })
  creditLimit: string | null;

  @ApiPropertyOptional({ description: 'Annual interest rate percent' })
  interestRate: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  dueDate: Date | null;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  excludeFromNetWorth: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(account: FinanceAccount) {
    this.id = account.id;
    this.userId = account.userId;
    this.name = account.name;
    this.kind = account.kind;
    this.valuationMode = account.valuationMode;
    this.currency = account.currency;
    this.openingBalance = account.openingBalance.toString();
    this.openingDate = account.openingDate;
    this.institution = account.institution;
    this.color = account.color;
    this.icon = account.icon;
    this.counterparty = account.counterparty;
    this.creditLimit = dec(account.creditLimit);
    this.interestRate = dec(account.interestRate);
    this.dueDate = account.dueDate;
    this.isArchived = account.isArchived;
    this.excludeFromNetWorth = account.excludeFromNetWorth;
    this.sortOrder = account.sortOrder;
    this.createdAt = account.createdAt;
    this.updatedAt = account.updatedAt;
  }
}

export class ValuationResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({ description: 'Value as string decimal' })
  value: string;

  @ApiPropertyOptional()
  remark: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  valuedAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  constructor(v: {
    id: string;
    accountId: string;
    value: Prisma.Decimal;
    remark: string | null;
    valuedAt: Date;
    createdAt: Date;
  }) {
    this.id = v.id;
    this.accountId = v.accountId;
    this.value = v.value.toString();
    this.remark = v.remark;
    this.valuedAt = v.valuedAt;
    this.createdAt = v.createdAt;
  }
}
