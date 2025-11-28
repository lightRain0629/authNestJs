import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '@user/user.module';
import { options } from './config';
import { STRATEGIES } from './strategies';
import { GUARDS } from './guards';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MailerModule } from 'src/mailer/mailer.module';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ...STRATEGIES,
    ...GUARDS,
  ],
  imports: [
    PassportModule,
    JwtModule.registerAsync(options()),
    UserModule,
    HttpModule,
    MailerModule,
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60000, // 1 минута
        limit: 10, // 10 запросов в минуту для auth эндпоинтов
      },
    ]),
  ],
})
export class AuthModule {}
