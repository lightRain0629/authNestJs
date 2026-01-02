import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces';
import { UserService } from '@user/user.service';
import { User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user: User = await this.userService
      .findOne(payload.id)
      .catch((err) => {
        this.logger.error(err);
        return null;
      });
    if (!user || user.isBlocked) {
      throw new UnauthorizedException();
    }

    const activeSession = await this.prismaService.token.findFirst({
      where: {
        userId: payload.id,
        userAgent: payload.agent,
        ...(payload.deviceId ? { deviceId: payload.deviceId } : {}),
        exp: { gt: new Date() },
      },
    });

    if (!activeSession) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
