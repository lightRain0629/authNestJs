import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Query,
  Req,
  Put,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponse } from './responses';
import { CurrentUser, Roles } from '@common/src/decorators';
import { JwtPayload } from 'src/auth/interfaces';
import { Role, User } from '@prisma/client';
import { RolesGuard } from 'src/auth/guards/role.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { buildPagination, PaginationResult } from '@common/src/helpers';
import { Request } from 'express';

@ApiTags('user')
@ApiExtraModels(UserResponse)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @UseGuards(RolesGuard)
  // @Roles(Role.ADMIN)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get authenticated user payload' })
  @ApiOkResponse({
    description: 'JWT payload of current user',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        roles: {
          type: 'array',
          items: { type: 'string', enum: Object.values(Role) },
        },
      },
    },
  })
  async me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('/all')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'query',
    required: false,
    type: String,
    description: 'Filter by email',
  })
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({
    description: 'Paginated list of users',
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
              items: { $ref: getSchemaPath(UserResponse) },
            },
          },
        },
      ],
    },
  })
  async getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Req() req: Request,
    @Query('query') search?: string,
  ): Promise<PaginationResult<UserResponse>> {
    const { items, total } = await this.userService.findAll(
      page,
      limit,
      search,
    );
    const users = items.map((user) => new UserResponse(user));
    const path = req.originalUrl.split('?')[0];
    const queryString = search
      ? `query=${encodeURIComponent(search)}`
      : undefined;
    return buildPagination({
      data: users,
      total,
      page,
      limit,
      queryString,
      path,
      extraParams: { query: search },
    });
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':idOrEmail')
  @ApiOperation({ summary: 'Find a user by id or email' })
  @ApiParam({ name: 'idOrEmail', description: 'User identifier or email' })
  @ApiOkResponse({ type: UserResponse, description: 'User information' })
  async findOneUser(@Param('idOrEmail') idOrEmail: string) {
    const user = await this.userService.findOne(idOrEmail);
    return new UserResponse(user);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a user by id' })
  @ApiParam({ name: 'id', description: 'UUID of the user to delete' })
  @ApiOkResponse({
    description: 'Identifier of removed user',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.delete(id, user);
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Put()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update existing user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        roles: {
          type: 'array',
          items: { type: 'string', enum: Object.values(Role) },
        },
        provider: { type: 'string' },
        isBlocked: { type: 'boolean' },
      },
    },
  })
  @ApiOkResponse({ type: UserResponse, description: 'Updated user' })
  async updateUser(@Body() body: Partial<User>) {
    const user = await this.userService.save(body);
    return new UserResponse(user);
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Patch user by id' })
  @ApiParam({ name: 'id', description: 'UUID of the user to update' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        roles: {
          type: 'array',
          items: { type: 'string', enum: Object.values(Role) },
        },
        provider: { type: 'string' },
        isBlocked: { type: 'boolean' },
        isVerified: { type: 'boolean' },
      },
    },
  })
  @ApiOkResponse({ type: UserResponse, description: 'Patched user' })
  async patchUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Partial<User>,
    @CurrentUser() requester: JwtPayload,
  ): Promise<UserResponse> {
    if (requester.id !== id && !requester.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException();
    }
    const user = await this.userService.updatePartial(id, body);
    return new UserResponse(user);
  }
}
