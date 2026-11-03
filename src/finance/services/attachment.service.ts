import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FinanceAttachment, Prisma } from '@prisma/client';
import { ReadStream } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
  attachmentExtension,
  attachmentTypeFor,
  isAcceptedClientMimeType,
} from '../attachments.constants';
import { AttachmentStorageService } from './attachment-storage.service';

/** The part of a multer file this service reads. */
export interface UploadedAttachmentFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

/** Exactly one side is set — the same rule the DB CHECK enforces. */
export type AttachmentTarget =
  | { recordId: string; conversionId?: undefined }
  | { conversionId: string; recordId?: undefined };

const MAX_NAME_LENGTH = 255;

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AttachmentStorageService,
  ) {}

  /**
   * Accepts an upload that multer has already spooled to `.incoming/`. Every
   * path out of here either adopts that temp file under a fresh key or
   * deletes it, so a rejected upload leaves nothing behind.
   */
  async upload(
    userId: string,
    target: AttachmentTarget,
    file: UploadedAttachmentFile | undefined,
  ): Promise<FinanceAttachment> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    let storageKey: string | null = null;
    try {
      await this.assertTargetOwned(userId, target);

      if (file.size === 0) {
        throw new BadRequestException('File is empty');
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException('File is too large');
      }

      const originalName = AttachmentService.cleanFileName(file.originalname);
      const type = attachmentTypeFor(originalName);
      if (!type) {
        throw new UnsupportedMediaTypeException(
          `File type not allowed. Allowed: ${ATTACHMENT_EXTENSIONS.join(', ')}`,
        );
      }
      if (!isAcceptedClientMimeType(type, file.mimetype)) {
        throw new UnsupportedMediaTypeException(
          `File content type ${
            file.mimetype
          } does not match .${attachmentExtension(originalName)}`,
        );
      }
      const head = await this.storage.readHead(file.path);
      if (!type.sniff(head)) {
        throw new UnsupportedMediaTypeException(
          `File content is not a valid .${attachmentExtension(originalName)}`,
        );
      }

      const sha256 = await this.storage.sha256(file.path);
      storageKey = this.storage.newKey();
      await this.storage.adopt(file.path, storageKey);

      const attachment = await this.prisma.financeAttachment.create({
        data: {
          userId,
          recordId: target.recordId ?? null,
          conversionId: target.conversionId ?? null,
          originalName,
          mimeType: type.mimeType,
          sizeBytes: file.size,
          storageKey,
          sha256,
        },
      });
      storageKey = null; // owned by the row now
      return attachment;
    } catch (error) {
      // The entry may have been deleted between the check and the insert;
      // the FK refuses the row, and that reads as the entry being gone.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw this.notFound(target);
      }
      throw error;
    } finally {
      // An adopted file has moved away, so this only ever removes rejects;
      // a key still set here was adopted but never got its row.
      await this.storage.discardPath(file.path);
      if (storageKey) await this.storage.discard([storageKey]);
    }
  }

  async list(
    userId: string,
    target: AttachmentTarget,
  ): Promise<FinanceAttachment[]> {
    await this.assertTargetOwned(userId, target);
    return this.prisma.financeAttachment.findMany({
      where: { userId, ...target },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string): Promise<FinanceAttachment> {
    const attachment = await this.prisma.financeAttachment.findFirst({
      where: { id, userId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async openForDownload(
    id: string,
    userId: string,
  ): Promise<{ attachment: FinanceAttachment; stream: ReadStream }> {
    const attachment = await this.findOne(id, userId);
    if (!(await this.storage.exists(attachment.storageKey))) {
      this.logger.error(
        `Attachment ${attachment.id} has no file at ${attachment.storageKey}`,
      );
      throw new NotFoundException('Attachment file is missing');
    }
    return { attachment, stream: this.storage.open(attachment.storageKey) };
  }

  async remove(id: string, userId: string): Promise<FinanceAttachment> {
    const attachment = await this.findOne(id, userId);
    await this.prisma.financeAttachment.delete({ where: { id } });
    await this.storage.discard([attachment.storageKey]);
    return attachment;
  }

  /**
   * Collected before a record or conversion is deleted: the cascade removes
   * the rows, but only the application knows where the files are.
   */
  async storageKeysFor(target: AttachmentTarget): Promise<string[]> {
    const rows = await this.prisma.financeAttachment.findMany({
      where: target,
      select: { storageKey: true },
    });
    return rows.map((row) => row.storageKey);
  }

  async discardFiles(storageKeys: string[]): Promise<void> {
    if (storageKeys.length > 0) await this.storage.discard(storageKeys);
  }

  /** 404 for someone else's entry, exactly as for a missing one. */
  private async assertTargetOwned(
    userId: string,
    target: AttachmentTarget,
  ): Promise<void> {
    const found = target.recordId
      ? await this.prisma.financeRecord.findFirst({
          where: { id: target.recordId, userId },
          select: { id: true },
        })
      : await this.prisma.currencyConversion.findFirst({
          where: { id: target.conversionId, userId },
          select: { id: true },
        });
    if (!found) throw this.notFound(target);
  }

  private notFound(target: AttachmentTarget): NotFoundException {
    return new NotFoundException(
      target.recordId ? 'Record not found' : 'Conversion not found',
    );
  }

  /**
   * Multer (via busboy) decodes the multipart filename as latin1, which turns
   * "отчёт.xlsx" into mojibake; re-read those bytes as UTF-8 when that is what
   * they were. Then keep only a bare, printable name of sane length.
   */
  static cleanFileName(raw: string): string {
    let name = raw ?? '';
    if (!/[^\u0000-\u00ff]/.test(name)) {
      const utf8 = Buffer.from(name, 'latin1').toString('utf8');
      if (!utf8.includes('\uFFFD')) name = utf8;
    }

    name = name
      .split(/[\\/]/)
      .pop()!
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();

    if (name.length > MAX_NAME_LENGTH) {
      const ext = path.extname(name).slice(0, 16);
      name = name.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
    }

    return name || 'file';
  }

  /**
   * `filename` for old clients (ASCII only, quotes stripped) plus the RFC 5987
   * `filename*` that every current browser prefers, so non-Latin names survive.
   */
  static contentDisposition(fileName: string): string {
    const fallback =
      fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'file';
    const encoded = encodeURIComponent(fileName).replace(
      /['()*]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
  }
}
