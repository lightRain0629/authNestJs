import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SummaryResponse {
  @ApiProperty({
    description: 'Income totals by currency',
    example: { USD: '1000.00', EUR: '500.00' },
  })
  income: Record<string, string>;

  @ApiProperty({
    description: 'Expense totals by currency',
    example: { USD: '300.00', EUR: '150.00' },
  })
  expense: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Total income in base currency (if baseCurrency provided)',
  })
  incomeBaseCurrency?: string;

  @ApiPropertyOptional({
    description: 'Total expense in base currency (if baseCurrency provided)',
  })
  expenseBaseCurrency?: string;

  @ApiPropertyOptional({
    description: 'Net (income - expense) in base currency',
  })
  netBaseCurrency?: string;

  @ApiPropertyOptional({
    description: 'Conversion fees as expense by currency',
    example: { USD: '10.00' },
  })
  conversionFees?: Record<string, string>;

  constructor(data: Partial<SummaryResponse>) {
    Object.assign(this, data);
  }
}

export class ChartItemResponse {
  @ApiProperty({ description: 'Article (category) ID, null if uncategorized' })
  articleId: string | null;

  @ApiProperty({ description: 'Category name or "No Category"' })
  categoryName: string;

  @ApiProperty({ description: 'Category hex color' })
  categoryColor: string;

  @ApiProperty({ description: 'Total amount as string' })
  total: string;

  @ApiProperty({ description: 'ISO 4217 currency code' })
  currency: string;

  @ApiProperty({ description: 'Percentage of total for this currency' })
  percentage: number;
}

export class ChartResponse {
  @ApiProperty({ type: [ChartItemResponse] })
  items: ChartItemResponse[];

  @ApiProperty({
    description: 'Grand total per currency',
    example: { KZT: '795000.0000' },
  })
  total: Record<string, string>;

  constructor(data: ChartResponse) {
    Object.assign(this, data);
  }
}
