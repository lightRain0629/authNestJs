import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { genSaltSync, hashSync } from 'bcrypt';
import { JwtPayload } from 'src/auth/interfaces';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { convertToSecondsUtil } from '@common/src/utils';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  async save(user: Partial<User>) {
    const hashedPassword = user?.password
      ? this.hashPassword(user.password)
      : null;
    const savedUser = await this.prismaService.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        password: hashedPassword ?? undefined,
        roles: user?.roles ?? undefined,
        provider: user?.provider ?? undefined,
        isBlocked: user?.isBlocked ?? undefined,
        isVerified: user?.isVerified ?? undefined,
      },
      create: {
        email: user.email,
        password: hashedPassword,
        roles: ['USER'],
        provider: user?.provider,
        isVerified: user?.isVerified ?? false,
      },
    });
    // await this.cacheManager.set(savedUser.id, savedUser);
    // await this.cacheManager.set(savedUser.email, savedUser);
    return savedUser;
  }

  async findOne(idOrEmail: string, isReset = false) {
    if (isReset) {
      await this.cacheManager.del(idOrEmail);
    }

    const user = await this.cacheManager.get<User>(idOrEmail);
    if (!user) {
      const user = await this.prismaService.user.findFirst({
        where: {
          OR: [
            {
              id: idOrEmail,
            },
            {
              email: idOrEmail,
            },
          ],
        },
      });
      if (!user) {
        return null;
      }
      await this.cacheManager.set(
        idOrEmail,
        user,
        convertToSecondsUtil(this.configService.get('JWT_EXP')),
      );
      return user;
    }
    return user;
  }

  async findAll() {
    return this.prismaService.user.findMany();
  }

  async delete(id: string, user: JwtPayload) {
    if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException();
    }

    await Promise.all([
      this.cacheManager.del(id),
      this.cacheManager.del(user.email),
    ]);
    return this.prismaService.user.delete({
      where: { id },
      select: {
        id: true,
      },
    });
  }

  private hashPassword(password: string) {
    return hashSync(password, genSaltSync(10));
  }
}
