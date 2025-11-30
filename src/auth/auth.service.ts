import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto';
import { UserService } from '@user/user.service';
import { LoginDto } from './dto/login.dto';
import { Tokens } from './interfaces';
import { compareSync } from 'bcrypt';
import { Provider, Token, User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prisma/prisma.service';
import { v4 } from 'uuid';
import { add } from 'date-fns';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailerService } from 'src/mailer/mailer.service';
import { UAParser } from 'ua-parser-js';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);
  private readonly resetTokenTtlMinutes = 15;
  private readonly otpTtlMinutes = 10;
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  async refreshTokens(
    refreshToken: string,
    agent: string,
    ip?: string,
    deviceId?: string,
  ): Promise<Tokens> {
    const token = await this.prismaService.token.findUnique({
      where: { token: refreshToken },
    });
    const isDeviceMismatch = token?.deviceId
      ? token.deviceId !== deviceId
      : token?.userAgent !== agent;
    if (!token || new Date(token.exp) < new Date() || isDeviceMismatch) {
      throw new UnauthorizedException();
    }
    await this.prismaService.token.delete({ where: { token: refreshToken } });
    const user = await this.userService.findOne(token.userId);
    return this.generateTokens(user, agent, ip, deviceId);
  }

  async register(dto: RegisterDto) {
    const user: User = await this.userService
      .findOne(dto.email)
      .catch((err) => {
        this.logger.error(err);
        return null;
      });
    if (user) {
      throw new ConflictException('User with this mail already registered');
    }
    const created = await this.userService.save(
      Object.assign({}, dto, { isVerified: false }),
    );
    await this.sendEmailOtp(created.email);
    return created;
  }

  async login(
    dto: LoginDto,
    agent: string,
    ip?: string,
    deviceId?: string,
  ): Promise<Tokens> {
    const user: User = await this.userService
      .findOne(dto.email, true)
      .catch((err) => {
        this.logger.error(err);
        return null;
      });

    if (!!user?.provider && !user.password) {
      throw new BadRequestException(
        `User registered via ${user.provider}. Please use ${user.provider} login.`,
      );
    }

    if (!user || !compareSync(dto.password, user.password)) {
      throw new UnauthorizedException('Wrong password or username');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Email is not verified');
    }
    return this.generateTokens(user, agent, ip, deviceId);
  }

  private async generateTokens(
    user: User,
    agent: string,
    ip?: string,
    deviceId?: string,
  ): Promise<Tokens> {
    const accessToken =
      'Bearer ' +
      this.jwtService.sign({
        id: user.id,
        email: user.email,
        roles: user.roles,
        agent,
        deviceId,
      });
    const refreshToken = await this.getRefreshToken(
      user.id,
      agent,
      ip,
      deviceId,
    );
    return { accessToken, refreshToken };
  }

  private async getRefreshToken(
    userId: string,
    agent: string,
    ip?: string,
    deviceId?: string,
  ): Promise<Token> {
    const deviceWhere = deviceId
      ? { userId, deviceId }
      : { userId, userAgent: agent };

    // Reset any existing token for this device/userAgent to avoid upsert races.
    return this.prismaService.$transaction(async (tx) => {
      await tx.token.deleteMany({ where: deviceWhere });
      return tx.token.create({
        data: {
          token: v4(),
          exp: add(new Date(), { months: 1 }),
          userId,
          userAgent: agent,
          ip,
          deviceId,
          device: this.getDeviceLabel(agent),
        },
      });
    });
  }

  async deleteRefreshToken(token: string) {
    return this.prismaService.token.deleteMany({ where: { token } });
  }

  async providerAuth(
    email: string,
    agent: string,
    provider: Provider,
    ip?: string,
    deviceId?: string,
  ) {
    const userExist = await this.userService.findOne(email);
    if (userExist) {
      const user = await this.userService
        .save({ email, provider: provider, isVerified: true })
        .catch((err) => {
          this.logger.error(err);
          return null;
        });
      this.generateTokens(user, agent, ip, deviceId);
    }
    const user = await this.userService
      .save({ email, provider: provider, isVerified: true })
      .catch((err) => {
        this.logger.error(err);
        return null;
      });
    if (!user) {
      throw new BadRequestException(
        `Cannot generate user with ${email} by Google Auth`,
      );
    }
    return this.generateTokens(user, agent, ip, deviceId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userService.findOne(email).catch((err) => {
      this.logger.error(err);
      return null;
    });
    if (!user) {
      return;
    }

    await this.prismaService.passwordReset.deleteMany({
      where: { userId: user.id, used: false },
    });

    const token = v4();
    const reset = await this.prismaService.passwordReset.create({
      data: {
        token,
        userId: user.id,
        exp: add(new Date(), { minutes: this.resetTokenTtlMinutes }),
      },
    });

    this.logger.log(
      `Password reset token for ${email}: ${token}. Valid for ${this.resetTokenTtlMinutes} minutes.`,
    );

    await this.mailerService.sendMail({
      to: email,
      subject: 'Password reset request',
      text: `Use this code to reset your password: ${token}. It expires at ${reset.exp.toISOString()}`,
      html: `<p>You requested a password reset.</p><p>Use this token: <b>${token}</b></p><p>It expires at ${reset.exp.toISOString()}.</p>`,
      fromName: 'Auth Service',
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const resetRequest = await this.prismaService.passwordReset.findUnique({
      where: { token: dto.token },
    });

    if (
      !resetRequest ||
      resetRequest.used ||
      new Date(resetRequest.exp) < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.userService
      .findOne(resetRequest.userId)
      .catch(() => null);
    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    await this.userService.save({ email: user.email, password: dto.password });

    await this.prismaService.passwordReset.update({
      where: { token: dto.token },
      data: { used: true, usedAt: new Date() },
    });

    await this.prismaService.token.deleteMany({ where: { userId: user.id } });
  }

  async logoutOtherSessions(
    userId: string,
    agent: string,
    deviceId?: string,
  ): Promise<number> {
    const { count } = await this.prismaService.token.deleteMany({
      where: {
        userId,
        NOT: deviceId ? { userAgent: agent, deviceId } : { userAgent: agent },
      },
    });
    return count;
  }

  async logoutAllSessions(userId: string): Promise<number> {
    const { count } = await this.prismaService.token.deleteMany({
      where: { userId },
    });
    return count;
  }

  private getDeviceLabel(agent: string): string {
    try {
      const parser = new UAParser();
      parser.setUA(agent);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();
      const browserLabel = browser.name
        ? `${browser.name}${browser.version ? ` ${browser.version}` : ''}`
        : null;
      const osLabel = os.name
        ? `${os.name}${os.version ? ` ${os.version}` : ''}`
        : null;
      const deviceLabel = device.model
        ? `${device.vendor ? `${device.vendor} ` : ''}${device.model}`
        : null;
      const parts = [browserLabel, osLabel, deviceLabel].filter(Boolean);
      return parts.length ? parts.join(' | ') : agent || 'Unknown device';
    } catch (error) {
      this.logger.warn(`Failed to parse user agent: ${agent}`);
      return agent || 'Unknown device';
    }
  }

  async listSessions(
    userId: string,
    currentAgent?: string,
    currentDeviceId?: string,
  ) {
    const sessions = await this.prismaService.token.findMany({
      where: { userId, exp: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      sessionId: session.token.slice(-6),
      device: session.device ?? session.userAgent,
      userAgent: session.userAgent,
      ip: session.ip,
      deviceId: session.deviceId,
      createdAt: session.createdAt,
      exp: session.exp,
      isCurrent:
        !!currentAgent &&
        session.userAgent === currentAgent &&
        (!!currentDeviceId ? session.deviceId === currentDeviceId : true),
    }));
  }

  async sendEmailOtp(email: string): Promise<void> {
    const user = await this.userService.findOne(email);
    if (!user) {
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prismaService.emailOtp.deleteMany({
      where: { userId: user.id, used: false },
    });
    const exp = add(new Date(), { minutes: this.otpTtlMinutes });
    await this.prismaService.emailOtp.create({
      data: { code, userId: user.id, exp },
    });
    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your email',
      text: `Your verification code is ${code}. It expires at ${exp.toISOString()}`,
      html: `<p>Your verification code:</p><h2>${code}</h2><p>Expires at ${exp.toISOString()}</p>`,
      fromName: 'Auth Service',
    });
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userService.findOne(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid verification request');
    }

    const otp = await this.prismaService.emailOtp.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        used: false,
        exp: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prismaService.$transaction([
      this.prismaService.emailOtp.update({
        where: { id: otp.id },
        data: { used: true, usedAt: new Date() },
      }),
      this.prismaService.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
      this.prismaService.emailOtp.deleteMany({
        where: { userId: user.id, used: false },
      }),
    ]);

    return { message: 'Email verified' };
  }

  async resendOtp(dto: ResendOtpDto) {
    await this.sendEmailOtp(dto.email);
    return { message: 'Verification code sent if email exists' };
  }
}
