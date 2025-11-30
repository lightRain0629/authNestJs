import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import { CreateTodoDto, UpdateTodoDto } from './dto';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from 'src/auth/interfaces';
import { TodoResponse } from './responses';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { buildPagination, PaginationResult } from '@common/src/helpers';
import { Request } from 'express';

@ApiTags('todo')
@ApiBearerAuth('access-token')
@Controller('todos')
@ApiExtraModels(TodoResponse)
@UseInterceptors(ClassSerializerInterceptor)
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Post()
  @ApiOperation({ summary: 'Create a todo' })
  @ApiCreatedResponse({ type: TodoResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTodoDto,
  ): Promise<TodoResponse> {
    const todo = await this.todoService.create(user.id, dto);
    return new TodoResponse(todo);
  }

  @Get()
  @ApiOperation({ summary: 'List all todos for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'query', required: false, type: String, description: 'Filter todos by title' })
  @ApiOkResponse({
    description: 'Paginated todos for current user',
    schema: {
      allOf: [
        {
          type: 'object',
          properties: {
            count: { type: 'number' },
            current_page: { type: 'number' },
            total_pages: { type: 'number' },
            next: { type: 'string', nullable: true },
            previous: { type: 'string', nullable: true },
            results: {
              type: 'array',
              items: { $ref: getSchemaPath(TodoResponse) },
            },
          },
        },
      ],
    },
  })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Req() req: Request,
    @Query('query') search?: string,
  ): Promise<PaginationResult<TodoResponse>> {
    const { items, total } = await this.todoService.findAll(
      user.id,
      page,
      limit,
      search,
    );
    const todos = items.map((todo) => new TodoResponse(todo));
    const path = req.originalUrl.split('?')[0];
    const queryString = search ? `query=${encodeURIComponent(search)}` : undefined;
    return buildPagination({
      data: todos,
      total,
      page,
      limit,
      queryString,
      extraParams: { query: search },
      path,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find todo by id' })
  @ApiParam({ name: 'id', description: 'Todo identifier', format: 'uuid' })
  @ApiOkResponse({ type: TodoResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TodoResponse> {
    const todo = await this.todoService.findOne(id, user.id);
    return new TodoResponse(todo);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update existent todo' })
  @ApiParam({ name: 'id', description: 'Todo identifier', format: 'uuid' })
  @ApiOkResponse({ type: TodoResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTodoDto,
  ): Promise<TodoResponse> {
    const todo = await this.todoService.update(id, user.id, dto);
    return new TodoResponse(todo);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete todo' })
  @ApiParam({ name: 'id', description: 'Todo identifier', format: 'uuid' })
  @ApiOkResponse({ type: TodoResponse })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TodoResponse> {
    const todo = await this.todoService.remove(id, user.id);
    return new TodoResponse(todo);
  }
}
