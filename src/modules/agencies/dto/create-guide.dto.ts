import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Guide rattaché à l'agence : il se connecte ensuite par code OTP, par SMS
// ou par email (ADR 0003, ADR 0025) — au moins un des deux contacts.
export class CreateGuideDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: '+224620000000' })
  @ValidateIf((dto: CreateGuideDto) => dto.phone !== undefined || !dto.email)
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: 'guide@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
