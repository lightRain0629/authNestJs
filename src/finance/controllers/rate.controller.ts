import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { RateService } from '../services';
import { CreateRateDto, ListRatesDto, LatestRateDto } from '../dto';
import { RateResponse } from '../responses';

@ApiTags('finance/rates')
@ApiBearerAuth('access-token')
@Controller('finance/rates')
@UseInterceptors(ClassSerializerInterceptor)
export class RateController {
  constructor(private readonly rateService: RateService) {}

  @Post()
  @ApiOperation({ summary: 'Create a currency exchange rate' })
  @ApiCreatedResponse({ type: RateResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRateDto,
  ): Promise<RateResponse> {
    const rate = await this.rateService.create(user.id, dto);
    return new RateResponse(rate);
  }

  @Get()
  @ApiOperation({ summary: 'List currency rates with optional filters' })
  @ApiOkResponse({ type: [RateResponse] })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListRatesDto,
  ): Promise<RateResponse[]> {
    const rates = await this.rateService.findAll(user.id, query);
    return rates.map((r) => new RateResponse(r));
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest rate for a currency pair' })
  @ApiOkResponse({ type: RateResponse })
  async findLatest(
    @CurrentUser() user: JwtPayload,
    @Query() query: LatestRateDto,
  ): Promise<{
    rate: RateResponse;
    effectiveRate: string;
    isInverse: boolean;
  }> {
    const result = await this.rateService.findLatest(user.id, query);
    return {
      rate: new RateResponse(result.rate),
      effectiveRate: result.effectiveRate.toString(),
      isInverse: result.isInverse,
    };
  }
}
