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
  async create(@Body() dto: CreateRateDto): Promise<RateResponse> {
    const rate = await this.rateService.create(dto);
    return new RateResponse(rate);
  }

  @Get()
  @ApiOperation({ summary: 'List currency rates with optional filters' })
  @ApiOkResponse({ type: [RateResponse] })
  async findAll(@Query() query: ListRatesDto): Promise<RateResponse[]> {
    const rates = await this.rateService.findAll(query);
    return rates.map((r) => new RateResponse(r));
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest rate for a currency pair' })
  @ApiOkResponse({ type: RateResponse })
  async findLatest(@Query() query: LatestRateDto): Promise<{
    rate: RateResponse;
    effectiveRate: string;
    isInverse: boolean;
  }> {
    const result = await this.rateService.findLatest(query);
    return {
      rate: new RateResponse(result.rate),
      effectiveRate: result.effectiveRate.toString(),
      isInverse: result.isInverse,
    };
  }
}
