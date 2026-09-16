import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinancePlan,
  FinancePlanKind,
  FinancePlanPeriod,
  Prisma,
} from '@prisma/client';
import { Exclude, Transform } from 'class-transformer';

export class PlanResponse implements Omit<FinancePlan, 'amount'> {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Exclude()
  userId: string;

  @ApiProperty({ enum: FinancePlanKind })
  kind: FinancePlanKind;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, description: 'Decimal as string' })
  @Transform(({ value }: { value: Prisma.Decimal }) => value.toString())
  amount: string;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: FinancePlanPeriod })
  period: FinancePlanPeriod;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  endDate: Date | null;

  @ApiPropertyOptional({ format: 'uuid' })
  articleId: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  accountId: string | null;

  @ApiProperty({ default: false })
  isArchived: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(plan: FinancePlan) {
    Object.assign(this, plan, { amount: plan.amount.toString() });
  }
}

/** One plan measured against what actually happened in a given window. */
export class PlanProgressResponse {
  @ApiProperty({ type: PlanResponse })
  plan: PlanResponse;

  @ApiProperty({ type: String, description: 'Window start (ISO)' })
  periodStart: string;

  @ApiProperty({ type: String, description: 'Window end (ISO)' })
  periodEnd: string;

  @ApiProperty({ type: String, description: 'Planned amount for this window' })
  planned: string;

  @ApiProperty({ type: String, description: 'What actually happened' })
  actual: string;

  @ApiProperty({
    type: String,
    description: 'Planned minus actual. Negative means over a limit.',
  })
  remaining: string;

  @ApiProperty({ description: '0-100, clamped' })
  progress: number;

  @ApiProperty({ description: 'True once a LIMIT is exceeded' })
  isOverBudget: boolean;

  @ApiProperty({ description: 'True once a GOAL or SAVING target is met' })
  isAchieved: boolean;

  @ApiPropertyOptional({
    description:
      'Currencies that could not be converted into the plan currency.',
  })
  rateMissing: boolean;

  constructor(data: PlanProgressResponse) {
    Object.assign(this, data);
  }
}
