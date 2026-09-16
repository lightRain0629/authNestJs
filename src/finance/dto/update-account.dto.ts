import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAccountDto } from './create-account.dto';

/** Currency is immutable: changing it would invalidate every balance already derived. */
export class UpdateAccountDto extends PartialType(
  OmitType(CreateAccountDto, ['currency'] as const),
) {
  @ApiPropertyOptional({ description: 'Archive instead of delete' })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
