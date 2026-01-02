import { Module } from '@nestjs/common';
import {
  ArticleController,
  RecordController,
  RateController,
  ConversionController,
  SummaryController,
} from './controllers';
import {
  ArticleService,
  RecordService,
  RateService,
  ConversionService,
  SummaryService,
} from './services';

@Module({
  controllers: [
    ArticleController,
    RecordController,
    RateController,
    ConversionController,
    SummaryController,
  ],
  providers: [
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    SummaryService,
  ],
  exports: [
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    SummaryService,
  ],
})
export class FinanceModule {}
