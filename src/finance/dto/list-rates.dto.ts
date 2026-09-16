import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class ListRatesDto {
  @ApiPropertyOptional({
    description: 'Base currency filter',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Base currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  base?: string;

  @ApiPropertyOptional({
    description: 'Quote currency filter',
    example: 'EUR',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Quote currency must be a 2-10 character uppercase ticker (USD, TMT, BTC, USDT)',
  })
  quote?: string;

  @ApiPropertyOptional({
    description: 'From effective date',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'To effective date',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsOptional()
  to?: string;
}
