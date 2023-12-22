import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponse } from './responses';
import { CurrentUser, Roles } from '@common/src/decorators';
import { JwtPayload } from 'src/auth/interfaces';
import { Role } from '@prisma/client';
import { RolesGuard } from 'src/auth/guards/role.guard';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @UseInterceptors(ClassSerializerInterceptor)
    @Get(':idOrEmail')
    async findOneUser(@Param('idOrEmail') idOrEmail: string) {
        const user = await this.userService.findOne(idOrEmail);
        return new UserResponse(user);
    }


    @Delete(':id')
    async deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {

        return this.userService.delete(id, user);
    }

    // ? this endpoint only for admins... example for using guards, u can impliment this part for any endpoints that must use admins, not casual users... example(analytics or moderating)
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async me( @CurrentUser() user: JwtPayload) {
        return user;
    }
}
