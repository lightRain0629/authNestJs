import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import * as request from 'supertest';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceModule } from '../finance.module';
import { ATTACHMENT_MAX_BYTES } from '../attachments.constants';

/**
 * Drives the real HTTP stack — multer, the size cap, the type checks, the
 * stream back out — against a temp directory, with Prisma replaced by a small
 * in-memory store that honours `where` so user scoping is actually exercised.
 */
type Row = Record<string, any>;

const matches = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([k, v]) => v === undefined || row[k] === v);

const table = (rows: Row[]) => ({
  findFirst: jest.fn(
    async ({ where }: { where: Row }) =>
      rows.find((r) => matches(r, where)) ?? null,
  ),
  findMany: jest.fn(async ({ where }: { where: Row }) =>
    rows.filter((r) => matches(r, where)),
  ),
  create: jest.fn(async ({ data }: { data: Row }) => {
    const row = { id: randomUUID(), createdAt: new Date(), ...data };
    rows.push(row);
    return row;
  }),
  delete: jest.fn(async ({ where }: { where: Row }) => {
    const index = rows.findIndex((r) => r.id === where.id);
    return rows.splice(index, 1)[0];
  }),
});

const ALICE = 'user-alice';
const BOB = 'user-bob';
const RECORD_ID = randomUUID();
const CONVERSION_ID = randomUUID();

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const CSV = Buffer.from('date,amount\n2026-10-01,120.50\n');

describe('AttachmentController (http)', () => {
  let app: INestApplication;
  let dir: string;
  let attachments: Row[];

  const as = (userId: string) => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('x-test-user', userId),
    post: (url: string) =>
      request(app.getHttpServer()).post(url).set('x-test-user', userId),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('x-test-user', userId),
  });

  const storedFiles = () => readdirSync(dir).filter((f) => f !== '.incoming');
  const incomingFiles = () => readdirSync(path.join(dir, '.incoming'));

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'finance-attachments-'));
    process.env.FINANCE_ATTACHMENTS_DIR = dir;

    attachments = [];
    const prisma = {
      financeRecord: table([{ id: RECORD_ID, userId: ALICE }]),
      currencyConversion: table([{ id: CONVERSION_ID, userId: ALICE }]),
      financeAttachment: table(attachments),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        FinanceModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).user = { id: req.header('x-test-user') };
      next();
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
    delete process.env.FINANCE_ATTACHMENTS_DIR;
  });

  it('uploads, lists, downloads and deletes a record attachment', async () => {
    const upload = await as(ALICE)
      .post(`/api/finance/records/${RECORD_ID}/attachments`)
      .attach('file', PDF, {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(upload.body).toMatchObject({
      recordId: RECORD_ID,
      conversionId: null,
      originalName: 'statement.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
    });
    expect(upload.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(upload.body).not.toHaveProperty('storageKey');
    expect(upload.body).not.toHaveProperty('userId');

    // Stored under a random key, never the user's name, and nothing left
    // behind in the spool.
    const [stored] = storedFiles();
    expect(stored).toMatch(/^[0-9a-f-]{36}$/);
    expect(incomingFiles()).toHaveLength(0);

    const list = await as(ALICE)
      .get(`/api/finance/records/${RECORD_ID}/attachments`)
      .expect(200);
    expect(list.body.map((a: Row) => a.id)).toEqual([upload.body.id]);

    const download = await as(ALICE)
      .get(`/api/finance/attachments/${upload.body.id}/download`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toBe(
      `attachment; filename="statement.pdf"; filename*=UTF-8''statement.pdf`,
    );
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(download.body, PDF)).toBe(0);

    await as(ALICE)
      .delete(`/api/finance/attachments/${upload.body.id}`)
      .expect(200);
    expect(storedFiles()).toHaveLength(0);
    await as(ALICE)
      .get(`/api/finance/attachments/${upload.body.id}/download`)
      .expect(404);
  });

  it('attaches to a conversion and keeps a Cyrillic file name intact', async () => {
    const name = 'Продажи GiftHub октябрь.csv';
    const upload = await as(ALICE)
      .post(`/api/finance/conversions/${CONVERSION_ID}/attachments`)
      .attach('file', CSV, { filename: name, contentType: 'text/csv' })
      .expect(201);

    expect(upload.body.originalName).toBe(name);
    expect(upload.body.conversionId).toBe(CONVERSION_ID);
    expect(upload.body.recordId).toBeNull();

    const download = await as(ALICE)
      .get(`/api/finance/attachments/${upload.body.id}/download`)
      .expect(200);
    expect(download.headers['content-disposition']).toContain(
      `filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    // The ASCII fallback carries no raw non-ASCII bytes.
    expect(download.headers['content-disposition']).toMatch(
      /^attachment; filename="[\x20-\x7e]+";/,
    );

    await as(ALICE)
      .delete(`/api/finance/attachments/${upload.body.id}`)
      .expect(200);
  });

  describe("another user's entries", () => {
    let aliceAttachmentId: string;

    beforeAll(async () => {
      const upload = await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', CSV, { filename: 'mine.csv', contentType: 'text/csv' })
        .expect(201);
      aliceAttachmentId = upload.body.id;
    });

    afterAll(async () => {
      await as(ALICE).delete(`/api/finance/attachments/${aliceAttachmentId}`);
    });

    it('cannot attach to them', async () => {
      await as(BOB)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', CSV, { filename: 'x.csv', contentType: 'text/csv' })
        .expect(404);
      await as(BOB)
        .post(`/api/finance/conversions/${CONVERSION_ID}/attachments`)
        .attach('file', CSV, { filename: 'x.csv', contentType: 'text/csv' })
        .expect(404);
      // The rejected upload's spool file is cleaned up.
      expect(incomingFiles()).toHaveLength(0);
      expect(storedFiles()).toHaveLength(1);
    });

    it('cannot list, download or delete them', async () => {
      await as(BOB)
        .get(`/api/finance/records/${RECORD_ID}/attachments`)
        .expect(404);
      await as(BOB)
        .get(`/api/finance/attachments/${aliceAttachmentId}/download`)
        .expect(404);
      await as(BOB)
        .delete(`/api/finance/attachments/${aliceAttachmentId}`)
        .expect(404);
      expect(attachments).toHaveLength(1);
      expect(storedFiles()).toHaveLength(1);
    });
  });

  describe('rejects', () => {
    afterEach(() => {
      expect(storedFiles()).toHaveLength(0);
      expect(incomingFiles()).toHaveLength(0);
    });

    it('a type outside the allow-list', async () => {
      const res = await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', Buffer.from('MZ\x90\x00'), {
          filename: 'invoice.exe',
          contentType: 'application/octet-stream',
        })
        .expect(415);
      expect(res.body.message).toContain('not allowed');
    });

    it('an allowed extension whose content is something else', async () => {
      await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', Buffer.from('<html><script>alert(1)</script>'), {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        })
        .expect(415);
    });

    it('a content type that contradicts the extension', async () => {
      await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', PDF, {
          filename: 'report.pdf',
          contentType: 'text/html',
        })
        .expect(415);
    });

    it('a file over the size limit', async () => {
      await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', Buffer.alloc(ATTACHMENT_MAX_BYTES + 1, 0x61), {
          filename: 'huge.txt',
          contentType: 'text/plain',
        })
        .expect(413);
    });

    it('an empty file', async () => {
      await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .attach('file', Buffer.alloc(0), {
          filename: 'empty.csv',
          contentType: 'text/csv',
        })
        .expect(400);
    });

    it('a request with no file', async () => {
      await as(ALICE)
        .post(`/api/finance/records/${RECORD_ID}/attachments`)
        .field('note', 'no file')
        .expect(400);
    });
  });

  it('returns 404 for a record that does not exist', async () => {
    await as(ALICE)
      .get(`/api/finance/records/${randomUUID()}/attachments`)
      .expect(404);
  });
});
