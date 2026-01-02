import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendOtpDto,
} from './dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { Tokens } from './interfaces';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import {
  Cookie,
  CurrentUser,
  Public,
  UserAgent,
  IpAddress,
  DeviceId,
} from '@common/src/decorators';
import { Provider } from '@prisma/client';
import { UserResponse } from '@user/responses';
import { GoogleGuard } from './guards/google.guard';
import { HttpService } from '@nestjs/axios';
import { map, mergeMap } from 'rxjs';
import { handleTimeoutAndErrors } from '@common/src/helpers';
import { YandexGuard } from './guards/yandex.guard';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtPayload } from './interfaces';

const REFRESH_TOKEN = 'refreshtoken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({
    description: 'User successfully registered',
    type: UserResponse,
  })
  @ApiBadRequestResponse({ description: 'Registration data is invalid' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    if (!user) {
      throw new BadRequestException(
        `Cannot to register as user with data ${JSON.stringify(dto)}`,
      );
    }
    return new UserResponse(user);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Authenticate user credentials' })
  @ApiCreatedResponse({
    description: 'Tokens issued and refresh token stored in cookie',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid credentials supplied' })
  async login(
    @Body() dto: LoginDto,
    @Res() res: Response,
    @UserAgent() agent: string,
    @IpAddress() ip: string,
    @DeviceId() deviceId?: string,
  ) {
    const tokens = await this.authService.login(dto, agent, ip, deviceId);

    if (!tokens) {
      throw new BadRequestException(
        `Cannot to login as user with data ${JSON.stringify(dto)}`,
      );
    }
    this.setRefreshTokenToCookies(tokens, res);
  }

  @Get('refresh-tokens')
  @Public()
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiCookieAuth('refreshtoken')
  @ApiCreatedResponse({
    description: 'Tokens refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token missing or invalid' })
  async refreshTokens(
    @Cookie(REFRESH_TOKEN) refreshToken: string,
    @Res() res: Response,
    @UserAgent() agent: string,
    @IpAddress() ip: string,
    @DeviceId() deviceId?: string,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    const tokens = await this.authService.refreshTokens(
      refreshToken,
      agent,
      ip,
      deviceId,
    );
    if (!tokens) {
      throw new UnauthorizedException();
    }
    this.setRefreshTokenToCookies(tokens, res);
  }

  @Get('logout')
  @Public()
  @ApiOperation({ summary: 'Invalidate refresh token cookie' })
  @ApiCookieAuth('refreshtoken')
  @ApiOkResponse({ description: 'Refresh token removed' })
  async logout(
    @Cookie(REFRESH_TOKEN) refreshToken: string,
    @Res() res: Response,
  ) {
    if (!refreshToken) {
      res.sendStatus(HttpStatus.OK);
      return;
    }
    await this.authService.deleteRefreshToken(refreshToken);
    res.cookie(REFRESH_TOKEN, '', {
      httpOnly: true,
      secure: true,
      expires: new Date(),
    });
    res.sendStatus(HttpStatus.OK);
  }

  private setRefreshTokenToCookies(tokens: Tokens, res: Response) {
    if (!tokens) {
      throw new UnauthorizedException();
    }
    res.cookie(REFRESH_TOKEN, tokens.refreshToken.token, {
      httpOnly: true,
      sameSite: 'lax',
      expires: new Date(tokens.refreshToken.exp),
      secure:
        this.configService.get('NODE_ENV', 'development') === 'production',
      path: '/',
    });
    res.status(HttpStatus.CREATED).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken.token,
    });
  }

  @UseGuards(GoogleGuard)
  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth() {}

  @UseGuards(GoogleGuard)
  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const token = req.user['accessToken'];
    return res.redirect(`http://localhost:5173/oauth/google?token=${token}`);
  }

  @Get('success-google')
  @Public()
  @ApiOperation({ summary: 'Finalize Google OAuth login using token' })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'OAuth access token from Google',
  })
  successGoogle(
    @Query('token') token: string,
    @UserAgent() agent: string,
    @IpAddress() ip: string,
    @Res() res: Response,
    @DeviceId() deviceId?: string,
  ) {
    return this.httpService
      .get(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`,
      )
      .pipe(
        mergeMap(({ data: { email } }) =>
          this.authService.providerAuth(
            email,
            agent,
            Provider.GOOGLE,
            ip,
            deviceId,
          ),
        ),
        map((data) => this.setRefreshTokenToCookies(data, res)),
        handleTimeoutAndErrors(),
      );
  }

  @UseGuards(YandexGuard)
  @Get('yandex')
  @Public()
  @ApiOperation({ summary: 'Initiate Yandex OAuth flow' })
  yandexAuth() {}

  @UseGuards(YandexGuard)
  @Get('yandex/callback')
  @Public()
  @ApiOperation({ summary: 'Handle Yandex OAuth callback' })
  yandexAuthCallback(@Req() req: Request, @Res() res: Response) {
    const token = req.user['accessToken'];
    return res.redirect(`http://localhost:5173/oauth/yandex?token=${token}`);
  }

  @Get('success-yandex')
  @Public()
  @ApiOperation({ summary: 'Finalize Yandex OAuth login using token' })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'OAuth access token from Yandex',
  })
  successYandex(
    @Query('token') token: string,
    @UserAgent() agent: string,
    @IpAddress() ip: string,
    @Res() res: Response,
    @DeviceId() deviceId?: string,
  ) {
    return this.httpService
      .get(`https://login.yandex.ru/info?format=json&oauth_token=${token}`)
      .pipe(
        mergeMap(({ data: { default_email } }) =>
          this.authService.providerAuth(
            default_email,
            agent,
            Provider.YANDEX,
            ip,
            deviceId,
          ),
        ),

        map((data) => this.setRefreshTokenToCookies(data, res)),

        handleTimeoutAndErrors(),
      );
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Initiate forgot password flow' })
  @ApiOkResponse({
    description:
      'Reset token issued if user exists. Actual token is logged for now.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        'If the email is registered, a reset link has been sent to it. Token is logged for development.',
    };
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Complete password reset with token' })
  @ApiOkResponse({ description: 'Password updated and sessions invalidated' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  @Post('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiOkResponse({ description: 'Email verified' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-otp')
  @Public()
  @ApiOperation({ summary: 'Resend verification OTP code' })
  @ApiOkResponse({ description: 'OTP resent if user exists' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Delete('sessions/others')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate all sessions except the current one' })
  @ApiOkResponse({
    description: 'Count of revoked sessions (excluding current)',
    schema: { properties: { revoked: { type: 'number' } } },
  })
  async logoutOtherSessions(@CurrentUser() user: JwtPayload) {
    const revoked = await this.authService.logoutOtherSessions(
      user.id,
      user.agent,
      user.deviceId,
    );
    return { revoked };
  }

  @Delete('sessions')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('refreshtoken')
  @ApiOperation({
    summary: 'Invalidate all sessions including the current one',
  })
  @ApiOkResponse({
    description:
      'All refresh tokens removed. Refresh cookie is also cleared if present.',
    schema: { properties: { revoked: { type: 'number' } } },
  })
  async logoutAllSessions(
    @CurrentUser() user: JwtPayload,
    @Cookie(REFRESH_TOKEN) refreshToken: string,
    @Res() res: Response,
  ) {
    const revoked = await this.authService.logoutAllSessions(user.id);

    if (refreshToken) {
      res.cookie(REFRESH_TOKEN, '', {
        httpOnly: true,
        secure:
          this.configService.get('NODE_ENV', 'development') === 'production',
        expires: new Date(),
        path: '/',
      });
    }

    res.status(HttpStatus.OK).json({ revoked });
  }

  @Get('sessions')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active sessions with device information' })
  @ApiOkResponse({
    description: 'Active sessions',
    schema: {
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              device: { type: 'string' },
              userAgent: { type: 'string' },
              ip: { type: 'string' },
              deviceId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              exp: { type: 'string', format: 'date-time' },
              isCurrent: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  async listSessions(
    @CurrentUser() user: JwtPayload,
    @UserAgent() agent: string,
    @DeviceId() deviceId?: string,
  ) {
    const sessions = await this.authService.listSessions(
      user.id,
      agent,
      deviceId,
    );
    return { sessions };
  }
}
