import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { RealtimeTicketShape, SentShape } from '../../types';
import { RealtimeSessionsService } from '../realtime/realtime-sessions.service';
import { RealtimeTicketService } from '../realtime/realtime-ticket.service';
import { AuthService } from './auth.service';
import { AgencyLoginDto } from './dto/agency-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { toOtpContact } from './dto/otp-contact';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PasswordResetService } from './password-reset/password-reset.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly realtimeTickets: RealtimeTicketService,
    private readonly realtimeSessions: RealtimeSessionsService,
  ) {}

  // Pèlerin / guide — code par SMS (ADR 0003) ou par email (ADR 0025).
  // Limites dédiées contre l'abus d'envoi et le brute-force (ADR 0025 §6).
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto): Promise<SentShape> {
    return this.authService.requestOtp(toOtpContact(dto));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthTokensDto> {
    return this.authService.verifyOtp(
      toOtpContact(dto),
      dto.code,
      dto.fullName,
    );
  }

  // Agence / admin — voir ADR 0003.
  @Public()
  @Post('agency/login')
  @HttpCode(HttpStatus.OK)
  agencyLogin(@Body() dto: AgencyLoginDto): Promise<AuthTokensDto> {
    return this.authService.validateAgencyOrAdmin(dto.email, dto.password);
  }

  // Mot de passe oublié (agence / admin) — voir ADR 0026.
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<SentShape> {
    return this.passwordResetService.requestReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RefreshTokenDto,
  ): Promise<void> {
    await this.authService.logout(user.sub, dto.refreshToken);
    // Plus aucune connexion temps réel ne reste ouverte (ADR 0027).
    this.realtimeSessions.disconnectUser(user.sub);
  }

  // Ticket WebSocket à usage unique (ADR 0027) : appelé par le web à travers
  // son proxy authentifié, avant chaque (re)connexion Socket.IO.
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('realtime-ticket')
  @HttpCode(HttpStatus.OK)
  realtimeTicket(
    @CurrentUser() user: JwtPayload,
  ): Promise<RealtimeTicketShape> {
    return this.realtimeTickets.issue(user);
  }
}
