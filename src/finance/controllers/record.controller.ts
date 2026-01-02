import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { RecordService } from '../services';
import {
  CreateRecordDto,
  UpdateRecordDto,
  ListRecordsDto,
} from '../dto';
import { RecordResponse } from '../responses';
import {
  buildPagination,
  PaginationResult,
} from '@common/src/helpers/pagination.helper';

@ApiTags('finance/records')
@ApiBearerAuth('access-token')
@Controller('finance/records')
@UseInterceptors(ClassSerializerInterceptor)
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @ApiOperation({ summary: 'Create a finance record (expense/income)' })
  @ApiCreatedResponse({ type: RecordResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRecordDto,
  ): Promise<RecordResponse> {
    const record = await this.recordService.create(user.id, dto);
    return new RecordResponse(record);
  }

  @Get()
  @ApiOperation({ summary: 'List finance records with filters and pagination' })
  @ApiOkResponse({ description: 'Paginated list of records' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListRecordsDto,
    @Req() req: Request,
  ): Promise<PaginationResult<RecordResponse>> {
    const { items, total } = await this.recordService.findAll(user.id, query);
    const records = items.map((r) => new RecordResponse(r));
    const path = req.originalUrl.split('?')[0];

    return buildPagination({
      data: records,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      path,
      extraParams: {
        type: query.type,
        currency: query.currency,
        articleId: query.articleId,
        from: query.from,
        to: query.to,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single finance record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RecordResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RecordResponse> {
    const record = await this.recordService.findOne(id, user.id);
    return new RecordResponse(record);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a finance record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RecordResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRecordDto,
  ): Promise<RecordResponse> {
    const record = await this.recordService.update(id, user.id, dto);
    return new RecordResponse(record);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a finance record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RecordResponse })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RecordResponse> {
    const record = await this.recordService.remove(id, user.id);
    return new RecordResponse(record);
  }
}
