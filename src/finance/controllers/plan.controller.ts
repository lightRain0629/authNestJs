import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { PlanService } from '../services';
import {
  CreatePlanDto,
  UpdatePlanDto,
  ListPlansDto,
  PlanProgressDto,
} from '../dto';
import { PlanResponse, PlanProgressResponse } from '../responses';

@ApiTags('finance/plans')
@ApiBearerAuth('access-token')
@Controller('finance/plans')
@UseInterceptors(ClassSerializerInterceptor)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Post()
  @ApiOperation({ summary: 'Create a spending limit, savings goal or target' })
  @ApiCreatedResponse({ type: PlanResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePlanDto,
  ): Promise<PlanResponse> {
    return new PlanResponse(await this.planService.create(user.id, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List plans' })
  @ApiOkResponse({ type: [PlanResponse] })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListPlansDto,
  ): Promise<PlanResponse[]> {
    const plans = await this.planService.findAll(user.id, query);
    return plans.map((p) => new PlanResponse(p));
  }

  // Declared before ':id' so the literal route is not swallowed by the param.
  @Get('progress')
  @ApiOperation({ summary: 'Measure every plan against a window' })
  @ApiOkResponse({ type: [PlanProgressResponse] })
  async progress(
    @CurrentUser() user: JwtPayload,
    @Query() query: PlanProgressDto,
  ): Promise<PlanProgressResponse[]> {
    return this.planService.getProgress(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PlanResponse> {
    return new PlanResponse(await this.planService.findOne(id, user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanResponse> {
    return new PlanResponse(await this.planService.update(id, user.id, dto));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanResponse })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PlanResponse> {
    return new PlanResponse(await this.planService.remove(id, user.id));
  }
}
