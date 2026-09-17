import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionKind, TRANSACTION_KINDS } from '../dto';
import { ConversionResponse } from './conversion.response';
import { RecordResponse } from './record.response';

/**
 * One entry in the money timeline. Records and transfers are different enough
 * that flattening them into shared columns would lose half of each, so the
 * `kind` discriminates and the matching side carries the full detail.
 */
export class TransactionResponse {
  @ApiProperty({ enum: TRANSACTION_KINDS })
  kind: TransactionKind;

  @ApiProperty({
    description:
      'Id of the underlying record or conversion. Unique within a kind, ' +
      'so pair it with `kind` when keying a list.',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'What the timeline sorts on',
    type: String,
    format: 'date-time',
  })
  operationDate: Date;

  @ApiPropertyOptional({ type: RecordResponse })
  record: RecordResponse | null;

  @ApiPropertyOptional({ type: ConversionResponse })
  transfer: ConversionResponse | null;

  constructor(entry: {
    kind: TransactionKind;
    record?: RecordResponse | null;
    transfer?: ConversionResponse | null;
  }) {
    this.kind = entry.kind;
    this.record = entry.record ?? null;
    this.transfer = entry.transfer ?? null;

    const source = this.record ?? this.transfer;
    this.id = source!.id;
    this.operationDate = source!.operationDate;
  }
}
