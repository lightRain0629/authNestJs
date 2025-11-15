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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('todo')
@ApiBearerAuth('access-token')
@Controller('todos')
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
  @ApiOkResponse({ type: TodoResponse, isArray: true })
  async findAll(@CurrentUser() user: JwtPayload): Promise<TodoResponse[]> {
    const todos = await this.todoService.findAll(user.id);
    return todos.map((todo) => new TodoResponse(todo));
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
