import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissingRate } from './balance.response';

export class CashflowPoint {
  @ApiProperty({ description: 'Period start, ISO' })
  date: string;

  @ApiProperty({ description: 'Short label for an axis tick' })
  label: string;

  @ApiProperty()
  income: string;

  @ApiProperty()
  expense: string;

  @ApiProperty({ description: 'income minus expense' })
  net: string;
}

export class FlowLeg {
  @ApiProperty({ description: 'Category or account name' })
  name: string;

  @ApiPropertyOptional({ format: 'uuid' })
  id: string | null;

  @ApiProperty()
  color: string;

  @ApiProperty()
  total: string;

  @ApiProperty({ description: 'Share of that side of the flow, 0-100' })
  percentage: number;
}

export class CashflowResponse {
  @ApiProperty({ type: [CashflowPoint] })
  points: CashflowPoint[];

  @ApiProperty()
  baseCurrency: string;

  @ApiProperty({ description: 'Total income across the window' })
  totalIncome: string;

  @ApiProperty({ description: 'Total expense across the window' })
  totalExpense: string;

  @ApiProperty({ description: 'totalIncome minus totalExpense' })
  netFlow: string;

  @ApiProperty({
    description: 'Share of income kept, 0-100. Null when there was no income.',
    nullable: true,
  })
  savingsRate: number | null;

  @ApiProperty({ description: 'Mean expense per period' })
  averageExpense: string;

  @ApiProperty({ type: [FlowLeg], description: 'Where money came from' })
  incomeByCategory: FlowLeg[];

  @ApiProperty({ type: [FlowLeg], description: 'Where money went' })
  expenseByCategory: FlowLeg[];

  @ApiProperty({ type: [FlowLeg], description: 'Spending per account' })
  expenseByAccount: FlowLeg[];

  @ApiProperty({ type: [MissingRate] })
  missingRates: MissingRate[];

  constructor(partial: Partial<CashflowResponse>) {
    Object.assign(this, partial);
  }
}
