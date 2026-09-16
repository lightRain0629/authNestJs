import { Module } from '@nestjs/common';
import {
  AccountController,
  ArticleController,
  RecordController,
  RateController,
  ConversionController,
  SummaryController,
} from './controllers';
import {
  AccountService,
  ArticleService,
  RecordService,
  RateService,
  ConversionService,
  SummaryService,
} from './services';

@Module({
  controllers: [
    AccountController,
    ArticleController,
    RecordController,
    RateController,
    ConversionController,
    SummaryController,
  ],
  providers: [
    AccountService,
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    SummaryService,
  ],
  exports: [
    AccountService,
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    SummaryService,
  ],
})
export class FinanceModule {}
