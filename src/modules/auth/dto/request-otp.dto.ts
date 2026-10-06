import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsPhoneNumber, Validate, ValidateIf } from 'class-validator';
import { ExactlyOneContact } from './otp-contact';

// Soit `phone` (SMS), soit `email` (EmailJS, ADR 0025) — un seul des deux.
export class RequestOtpDto {
  @ApiPropertyOptional({ example: '+224620000000' })
  @ValidateIf((dto: RequestOtpDto) => dto.phone !== undefined)
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: 'pelerin@example.com' })
  @ValidateIf((dto: RequestOtpDto) => dto.email !== undefined)
  @IsEmail()
  email?: string;

  // Champ technique de validation croisée, absent du contrat.
  @ApiHideProperty()
  @Validate(ExactlyOneContact)
  readonly contact?: never;
}
