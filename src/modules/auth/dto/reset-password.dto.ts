import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  // Jeton base64url de 32 octets (43 caractères) — ADR 0026 §3.
  @ApiProperty()
  @IsString()
  @Length(43, 43)
  token!: string;

  // 72 : limite de bcrypt (ADR 0026 §5).
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  newPassword!: string;
}
