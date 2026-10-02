import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfig } from '../../config/configuration';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { emailOtpSenderProvider } from './otp/email-otp-sender.provider';
import { passwordResetMailerProvider } from './password-reset/password-reset-mailer';
import { PasswordResetService } from './password-reset/password-reset.service';
import { smsOtpSenderProvider } from './otp/sms-otp-sender.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.get('jwt', { infer: true }).accessSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    smsOtpSenderProvider,
    emailOtpSenderProvider,
    PasswordResetService,
    passwordResetMailerProvider,
  ],
  exports: [AuthService],
})
export class AuthModule {}
