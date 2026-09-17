import { Module } from '@nestjs/common';
import {
  AccountController,
  ArticleController,
  RecordController,
  RateController,
  ConversionController,
  TransactionController,
  SummaryController,
  PlanController,
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
} from './services';

@Module({
  controllers: [
    AccountController,
    ArticleController,
    RecordController,
    RateController,
    ConversionController,
    TransactionController,
    SummaryController,
    PlanController,
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
  ],
})
export class FinanceModule {}
