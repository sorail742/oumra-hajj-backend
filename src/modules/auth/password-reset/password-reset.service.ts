import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AppConfig } from '../../../config/configuration';
import { Role } from '../../../common/enums/role.enum';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { maskEmail } from '../otp/mask-email';
import {
  PASSWORD_RESET_MAILER,
  PasswordResetMailer,
} from './password-reset-mailer';

const SALT_ROUNDS = 12;
// Seuls les comptes à mot de passe (ADR 0003, ADR 0026 §2).
const RESET_ROLES: ReadonlySet<string> = new Set([Role.AGENCY, Role.ADMIN]);
const LIEN_INVALIDE = 'Lien invalide ou expiré';
// Hors production sans WEB_APP_URL : frontend local (`pnpm dev`, port 3010).
const WEB_APP_URL_LOCALE = 'http://localhost:3010';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(PASSWORD_RESET_MAILER)
    private readonly mailer: PasswordResetMailer,
  ) {}

  // Réponse identique que le compte existe ou non (ADR 0026 §1, §8).
  async requestReset(email: string): Promise<{ sent: true }> {
    if (!this.mailer.available) {
      throw new ServiceUnavailableException(
        "La réinitialisation du mot de passe n'est pas encore disponible",
      );
    }

    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user?.passwordHash || !user.isActive || !RESET_ROLES.has(user.role)) {
      return { sent: true };
    }

    const { ttlMinutes, webAppUrl } = this.configService.get('passwordReset', {
      infer: true,
    });
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      }),
    ]);

    // Fragment d'URL : jamais transmis au serveur web (ADR 0026 §4).
    const resetUrl = new URL(
      '/reset-password',
      webAppUrl || WEB_APP_URL_LOCALE,
    );
    resetUrl.hash = `token=${token}`;
    try {
      await this.mailer.send(
        user.email ?? email,
        resetUrl.toString(),
        ttlMinutes,
      );
    } catch (error) {
      this.logger.error(
        `Envoi du lien de réinitialisation vers ${maskEmail(email)} impossible (${(error as Error).name})`,
      );
    }
    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });
    if (
      !record ||
      record.expiresAt.getTime() < Date.now() ||
      !record.user.isActive
    ) {
      throw new BadRequestException(LIEN_INVALIDE);
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    // Usage unique et fermeture de toutes les sessions (ADR 0026 §5).
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revoked: false },
        data: { revoked: true },
      }),
    ]);
  }
}
