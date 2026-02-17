import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { SummaryService } from '../services';
import { ChartQueryDto, SummaryDto } from '../dto';
import { ChartResponse, SummaryResponse } from '../responses';

@ApiTags('finance/summary')
@ApiBearerAuth('access-token')
@Controller('finance/summary')
@UseInterceptors(ClassSerializerInterceptor)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  @ApiOperation({ summary: 'Get finance summary for a period' })
  @ApiOkResponse({ type: SummaryResponse })
  async getSummary(
    @CurrentUser() user: JwtPayload,
    @Query() query: SummaryDto,
  ): Promise<SummaryResponse> {
    return this.summaryService.getSummary(user.id, query);
  }

  @Get('chart/expenses')
  @ApiOperation({ summary: 'Get expense breakdown by category for charts' })
  @ApiOkResponse({ type: ChartResponse })
  async getExpenseChart(
    @CurrentUser() user: JwtPayload,
    @Query() query: ChartQueryDto,
  ): Promise<ChartResponse> {
    return this.summaryService.getExpenseChart(user.id, query);
  }

  @Get('chart/income')
  @ApiOperation({ summary: 'Get income breakdown by category for charts' })
  @ApiOkResponse({ type: ChartResponse })
  async getIncomeChart(
    @CurrentUser() user: JwtPayload,
    @Query() query: ChartQueryDto,
  ): Promise<ChartResponse> {
    return this.summaryService.getIncomeChart(user.id, query);
  }
}
