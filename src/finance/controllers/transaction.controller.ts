import {
  Controller,
  Get,
  Query,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { TransactionService } from '../services';
import { ListTransactionsDto } from '../dto';
import {
  buildPagination,
  PaginationResult,
} from '@common/src/helpers/pagination.helper';
import { TransactionResponse } from '../responses';

@ApiTags('finance/transactions')
@ApiBearerAuth('access-token')
@Controller('finance/transactions')
@UseInterceptors(ClassSerializerInterceptor)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({
    summary: 'One timeline of expenses, incomes and transfers',
    description:
      'Merges records and currency conversions into a single date-ordered, ' +
      'paginated list. Filter to one kind with `kind`; an `accountId` matches ' +
      'either side of a transfer.',
  })
  @ApiOkResponse({ description: 'Paginated list of transactions' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListTransactionsDto,
    @Req() req: Request,
  ): Promise<PaginationResult<TransactionResponse>> {
    const { items, total } = await this.transactionService.findAll(
      user.id,
      query,
    );
    const path = req.originalUrl.split('?')[0];

    return buildPagination({
      data: items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      path,
      extraParams: {
        kind: query.kind,
        currency: query.currency,
        articleId: query.articleId,
        accountId: query.accountId,
        from: query.from,
        to: query.to,
        search: query.search,
        sortOrder: query.sortOrder,
      },
    });
  }
}
