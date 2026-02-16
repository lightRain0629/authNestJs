import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceRecordType } from '@prisma/client';
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

export class CreateRecordDto {
  @ApiProperty({
    description: 'Record type (EXPENSE or INCOME)',
    enum: FinanceRecordType,
    example: 'EXPENSE',
  })
  @IsEnum(FinanceRecordType)
  @IsNotEmpty()
  type: FinanceRecordType;

  @ApiProperty({
    description: 'Amount as string decimal (positive)',
    example: '150.50',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'Amount must be a positive decimal string with up to 4 decimal places',
  })
  amount: string;

  @ApiProperty({
    description: 'Currency ISO code (3 letters, uppercase)',
    example: 'USD',
    maxLength: 3,
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter ISO code in uppercase',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Article (category) ID',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  articleId?: string;

  @ApiPropertyOptional({
    description: 'Optional remark/note',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({
    description: 'Operation date (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  operationDate: string;
}
