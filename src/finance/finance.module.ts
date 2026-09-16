import { Module } from '@nestjs/common';
import {
  AccountController,
  ArticleController,
  RecordController,
  RateController,
  ConversionController,
  SummaryController,
  PlanController,
} from './controllers';
import {
  AccountService,
  ArticleService,
  RecordService,
  RateService,
  ConversionService,
  SummaryService,
  PlanService,
} from './services';

@Module({
  controllers: [
    AccountController,
    ArticleController,
    RecordController,
    RateController,
    ConversionController,
    SummaryController,
    PlanController,
  ],
  providers: [
    AccountService,
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    SummaryService,
    PlanService,
  ],
  exports: [
    AccountService,
    ArticleService,
    RecordService,
    RateService,
    ConversionService,
    SummaryService,
    PlanService,
  ],
})
export class FinanceModule {}
