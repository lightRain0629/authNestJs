import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceAttachment } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class AttachmentResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Exclude()
  userId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  recordId: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  conversionId: string | null;

  @ApiProperty({ description: 'File name as uploaded' })
  originalName: string;

  @ApiProperty({ description: 'Type the file is served as' })
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty({ description: 'Hex SHA-256 of the stored bytes' })
  sha256: string;

  @Exclude()
  storageKey: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  constructor(attachment: FinanceAttachment) {
    this.id = attachment.id;
    this.userId = attachment.userId;
    this.recordId = attachment.recordId;
    this.conversionId = attachment.conversionId;
    this.originalName = attachment.originalName;
    this.mimeType = attachment.mimeType;
    this.sizeBytes = attachment.sizeBytes;
    this.sha256 = attachment.sha256;
    this.storageKey = attachment.storageKey;
    this.createdAt = attachment.createdAt;
  }
}
