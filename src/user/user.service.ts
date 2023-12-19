import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class UserService {
    constructor(private readonly prismaService: PrismaService) { }

    // TODO dont forget to hash pasword 
    save(user: Partial<User>) {
        return this.prismaService.user.create({
            data: {
                email: user.email,
                password: user.password,
                roles: ["USER"]
            }
        })
    }

    findOne(idOrEmail: string) {
        return this.prismaService.user.findFirst({
            where: {
                OR: [
                    {
                        id: idOrEmail
                    },
                    {
                        email: idOrEmail
                    }
                ]
            }
        })
    }

    delete(id: string) { 
        return this.prismaService.user.delete({ where:{ id }});
    }
}
