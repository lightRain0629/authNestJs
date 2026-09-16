import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancePlanKind, FinancePlanPeriod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({
    enum: FinancePlanKind,
    description:
      'LIMIT caps spending on a category, GOAL fills an account, SAVING targets income minus expense.',
  })
  @IsEnum(FinancePlanKind)
  kind: FinancePlanKind;

  @ApiProperty({ example: 'Food' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Target or ceiling', example: '500.00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: 'Amount must be a positive decimal with up to 8 decimal places',
  })
  amount: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message: 'Currency must be a 2-10 character uppercase ticker',
  })
  currency: string;

  @ApiProperty({ enum: FinancePlanPeriod })
  @IsEnum(FinancePlanPeriod)
  period: FinancePlanPeriod;

  @ApiProperty({ description: 'The rule applies from this date' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Closes the rule. Required in spirit for CUSTOM periods.',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'LIMIT: the category' })
  @IsUUID()
  @IsOptional()
  articleId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'GOAL: the account' })
  @IsUUID()
  @IsOptional()
  accountId?: string;
}
