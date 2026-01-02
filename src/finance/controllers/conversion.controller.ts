import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { ConversionService } from '../services';
import { CreateConversionDto, ListConversionsDto } from '../dto';
import { ConversionResponse } from '../responses';
import {
  buildPagination,
  PaginationResult,
} from '@common/src/helpers/pagination.helper';

@ApiTags('finance/conversions')
@ApiBearerAuth('access-token')
@Controller('finance/conversions')
@UseInterceptors(ClassSerializerInterceptor)
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a currency conversion' })
  @ApiCreatedResponse({ type: ConversionResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversionDto,
  ): Promise<ConversionResponse> {
    const conversion = await this.conversionService.create(user.id, dto);
    return new ConversionResponse(conversion);
  }

  @Get()
  @ApiOperation({ summary: 'List currency conversions with filters and pagination' })
  @ApiOkResponse({ description: 'Paginated list of conversions' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListConversionsDto,
    @Req() req: Request,
  ): Promise<PaginationResult<ConversionResponse>> {
    const { items, total } = await this.conversionService.findAll(user.id, query);
    const conversions = items.map((c) => new ConversionResponse(c));
    const path = req.originalUrl.split('?')[0];

    return buildPagination({
      data: conversions,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      path,
      extraParams: {
        fromCurrency: query.fromCurrency,
        toCurrency: query.toCurrency,
        from: query.from,
        to: query.to,
      },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single currency conversion' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ConversionResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConversionResponse> {
    const conversion = await this.conversionService.findOne(id, user.id);
    return new ConversionResponse(conversion);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a currency conversion' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ConversionResponse })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConversionResponse> {
    const conversion = await this.conversionService.remove(id, user.id);
    return new ConversionResponse(conversion);
  }
}
