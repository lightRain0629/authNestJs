import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, mkdirSync, promises as fs, ReadStream } from 'fs';
import * as path from 'path';
import {
  ATTACHMENT_SNIFF_BYTES,
  ATTACHMENTS_DIR_DEFAULT,
  ATTACHMENTS_DIR_ENV,
} from '../attachments.constants';

const STORAGE_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Where attachment bytes live: one flat directory on local disk, each file
 * named by a random UUID. The user's filename never touches the filesystem, so
 * there is nothing to traverse with and nothing to collide on. Uploads land in
 * `.incoming/` first and are renamed into place only once accepted, which is
 * atomic because both sit on the same volume.
 */
@Injectable()
export class AttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentStorageService.name);
  readonly root: string;
  readonly incomingDir: string;

  constructor(config: ConfigService) {
    this.root = AttachmentStorageService.resolveRoot(config);
    this.incomingDir = path.join(this.root, '.incoming');
  }

  static resolveRoot(config: ConfigService): string {
    return path.resolve(
      config.get<string>(ATTACHMENTS_DIR_ENV) || ATTACHMENTS_DIR_DEFAULT,
    );
  }

  onModuleInit() {
    mkdirSync(this.incomingDir, { recursive: true });
  }

  newKey(): string {
    return randomUUID();
  }

  /** Refuses anything that is not a key this service minted. */
  pathFor(storageKey: string): string {
    if (!STORAGE_KEY.test(storageKey)) {
      throw new Error(`Invalid attachment storage key: ${storageKey}`);
    }
    return path.join(this.root, storageKey);
  }

  async readHead(filePath: string): Promise<Buffer> {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(ATTACHMENT_SNIFF_BYTES);
      const { bytesRead } = await handle.read(
        buffer,
        0,
        ATTACHMENT_SNIFF_BYTES,
        0,
      );
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  sha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      createReadStream(filePath)
        .on('error', reject)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolve(hash.digest('hex')));
    });
  }

  /** Moves an accepted upload from `.incoming/` to its permanent key. */
  async adopt(tempPath: string, storageKey: string): Promise<void> {
    await fs.rename(tempPath, this.pathFor(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.pathFor(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  open(storageKey: string): ReadStream {
    return createReadStream(this.pathFor(storageKey));
  }

  /** Best effort: a file that is already gone is not an error. */
  async discardPath(filePath: string | undefined): Promise<void> {
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not remove ${filePath}: ${error}`);
      }
    }
  }

  async discard(storageKeys: string[]): Promise<void> {
    await Promise.all(
      storageKeys.map((key) => this.discardPath(this.pathFor(key))),
    );
  }
}
