import { PartialType } from '@nestjs/swagger';
import { CreateRateDto } from './create-rate.dto';

/**
 * Every field is optional, the currency pair included: a rate typed against the
 * wrong pair is exactly the mistake this endpoint exists to correct.
 */
export class UpdateRateDto extends PartialType(CreateRateDto) {}
