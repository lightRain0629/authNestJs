import { Module, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import * as path from 'path';
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
  attachmentTypeFor,
} from './attachments.constants';
import {
  AccountController,
  ArticleController,
  RecordController,
  RateController,
  ConversionController,
  TransactionController,
  SummaryController,
  PlanController,
  AttachmentController,
} from './controllers';
import {
  AccountService,
  ArticleService,
  RecordService,
  RateService,
  ConversionService,
  TransactionService,
  SummaryService,
  PlanService,
  AttachmentService,
  AttachmentStorageService,
} from './services';

@Module({
  imports: [
    // Uploads spool to disk, never to memory, and the size cap is enforced
    // while streaming so an oversized body is cut off rather than buffered.
    // An extension outside the allow-list is refused before a byte is written;
    // AttachmentService then checks the content itself.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: path.join(
            AttachmentStorageService.resolveRoot(config),
            '.incoming',
          ),
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
        limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1, parts: 10 },
        fileFilter: (_req, file, cb) => {
          const name = AttachmentService.cleanFileName(file.originalname);
          if (!attachmentTypeFor(name)) {
            return cb(
              new UnsupportedMediaTypeException(
                `File type not allowed. Allowed: ${ATTACHMENT_EXTENSIONS.join(
                  ', ',
                )}`,
              ),
              false,
            );
          }
          cb(null, true);
        },
      }),
    }),
  ],
  controllers: [
    AccountController,
    ArticleController,
    RecordController,
    RateController,
    ConversionController,
    TransactionController,
    SummaryController,
    PlanController,
    AttachmentController,
  ],
  providers: [
    AccountService,
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    TransactionService,
    SummaryService,
    PlanService,
    AttachmentService,
    AttachmentStorageService,
  ],
  exports: [
    AccountService,
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    TransactionService,
    SummaryService,
    PlanService,
    AttachmentService,
  ],
})
export class FinanceModule {}
