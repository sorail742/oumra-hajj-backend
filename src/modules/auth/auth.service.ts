import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { UsersService } from '../users/users.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { OtpSender, OTP_SENDER } from './otp/otp-sender.interface';

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;

interface Identity {
  id: string;
  role: Role;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
  ) {}

  async requestOtp(phone: string): Promise<{ sent: true }> {
    const { ttlSeconds, codeLength } = this.configService.get('otp', {
      infer: true,
    });
    const code = this.generateNumericCode(codeLength);
    const codeHash = await bcrypt.hash(code, SALT_ROUNDS);

    await this.prisma.otp.deleteMany({ where: { phone } });
    await this.prisma.otp.create({
      data: {
        phone,
        codeHash,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    await this.otpSender.send(phone, code);
    return { sent: true };
  }

  async verifyOtp(
    phone: string,
    code: string,
    fullName?: string,
  ): Promise<AuthTokensDto> {
    const otp = await this.prisma.otp.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException(
        'Nombre maximal de tentatives atteint, redemandez un code',
      );
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    await this.prisma.otp.delete({ where: { id: otp.id } });

    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({
        fullName: fullName ?? 'Pèlerin',
        phone,
        role: Role.PILGRIM,
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte suspendu');
    }

    return this.issueTokens(user);
  }

  async validateAgencyOrAdmin(
    email: string,
    password: string,
  ): Promise<AuthTokensDto> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte suspendu');
    }

    return this.issueTokens(user as unknown as Identity);
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokensDto> {
    const { refreshSecret } = this.configService.get('jwt', { infer: true });
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(rawRefreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const stored = await this.findMatchingRefreshToken(
      payload.sub,
      rawRefreshToken,
    );
    if (!stored) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const user = await this.usersService.findByIdOrFail(payload.sub);
    if (!user.isActive) {
      throw new UnauthorizedException('Compte suspendu');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });
    return this.issueTokens(user);
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const stored = await this.findMatchingRefreshToken(userId, rawRefreshToken);
    if (stored) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revoked: true },
      });
    }
  }

  private async issueTokens(user: Identity): Promise<AuthTokensDto> {
    const { accessSecret, accessExpiresIn, refreshSecret, refreshExpiresIn } =
      this.configService.get('jwt', { infer: true });

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    const tokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async findMatchingRefreshToken(
    userId: string,
    rawRefreshToken: string,
  ): Promise<{ id: string; tokenHash: string } | null> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(rawRefreshToken, candidate.tokenHash)) {
        return candidate;
      }
    }
    return null;
  }

  private generateNumericCode(length: number): string {
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }
}
