import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponse } from './responses';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from 'src/auth/interfaces';

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
}
