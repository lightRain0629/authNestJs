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
import { SummaryDto } from '../dto';
import { SummaryResponse } from '../responses';

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
}
