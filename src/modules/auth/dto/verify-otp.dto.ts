import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MinLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { ExactlyOneContact } from './otp-contact';

// Même destinataire que la demande : `phone` ou `email` (ADR 0025).
export class VerifyOtpDto {
  @ApiPropertyOptional({ example: '+224620000000' })
  @ValidateIf((dto: VerifyOtpDto) => dto.phone !== undefined)
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: 'pelerin@example.com' })
  @ValidateIf((dto: VerifyOtpDto) => dto.email !== undefined)
  @IsEmail()
  email?: string;

  // Champ technique de validation croisée, absent du contrat.
  @ApiHideProperty()
  @Validate(ExactlyOneContact)
  readonly contact?: never;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;
}
