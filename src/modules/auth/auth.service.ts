import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { OtpSender, OTP_SENDER } from './otp/otp-sender.interface';
import { Otp, OtpDocument } from './schemas/otp.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
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

    await this.otpModel.deleteMany({ phone });
    await this.otpModel.create({
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });

    await this.otpSender.send(phone, code);
    return { sent: true };
  }

  async verifyOtp(
    phone: string,
    code: string,
    fullName?: string,
  ): Promise<AuthTokensDto> {
    const otp = await this.otpModel
      .findOne({ phone })
      .sort({ createdAt: -1 })
      .exec();
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
      await this.otpModel.updateOne(
        { _id: otp._id },
        { $inc: { attempts: 1 } },
      );
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    await this.otpModel.deleteOne({ _id: otp._id });

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

    return this.issueTokens(user);
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

    await this.refreshTokenModel.updateOne(
      { _id: stored._id },
      { revoked: true },
    );
    return this.issueTokens(user);
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const stored = await this.findMatchingRefreshToken(userId, rawRefreshToken);
    if (stored) {
      await this.refreshTokenModel.updateOne(
        { _id: stored._id },
        { revoked: true },
      );
    }
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokensDto> {
    const { accessSecret, accessExpiresIn, refreshSecret, refreshExpiresIn } =
      this.configService.get('jwt', { infer: true });

    const payload: JwtPayload = {
      sub: (user._id as Types.ObjectId).toString(),
      role: user.role,
      phone: user.phone,
      email: user.email,
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
    await this.refreshTokenModel.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(decoded.exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  private async findMatchingRefreshToken(
    userId: string,
    rawRefreshToken: string,
  ): Promise<RefreshTokenDocument | null> {
    const candidates = await this.refreshTokenModel
      .find({
        user: new Types.ObjectId(userId),
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .exec();

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
