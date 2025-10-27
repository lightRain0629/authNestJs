import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':idOrEmail')
  @ApiOperation({ summary: 'Find a user by id or email' })
  @ApiParam({ name: 'idOrEmail', description: 'User identifier or email' })
  @ApiOkResponse({ type: UserResponse, description: 'User information' })
  async findOneUser(@Param('idOrEmail') idOrEmail: string) {
    const user = await this.userService.findOne(idOrEmail);
    return new UserResponse(user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({
    type: UserResponse,
    isArray: true,
    description: 'List of users',
  })
  async getAll() {
    const users = await this.userService.findAll();
    return users.map((user) => new UserResponse(user));
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
}
