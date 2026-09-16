import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** A point-in-time worth for VALUED accounts (property, market-priced holdings). */
export class CreateValuationDto {
  @ApiProperty({
    description: 'Account worth at valuedAt',
    example: '250000.00',
  })
  @IsString()
  @Matches(/^-?\d+(\.\d{1,8})?$/, { message: 'Invalid value' })
  value: string;

  @ApiProperty({ description: 'When this valuation applies' })
  @IsDateString()
  valuedAt: string;

  @ApiPropertyOptional({ example: 'Appraisal from the agency' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;
}
