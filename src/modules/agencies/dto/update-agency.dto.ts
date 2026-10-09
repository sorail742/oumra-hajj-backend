import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Coordonnées bancaires de l'agence (versements de la plateforme) : les
// trois champs sont exigés ensemble et validés un à un — un objet
// partiel ou vide n'écrase plus des coordonnées existantes.
export class BankDetailsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accountName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  accountNumber!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankName!: string;
}

export class UpdateAgencyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  // Idée #37 : mentions légales des factures et contrats.
  @ApiPropertyOptional({ description: "NIF — numéro d'identification fiscale" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  @ApiPropertyOptional({ description: 'RCCM — registre du commerce' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tradeRegister?: string;

  @ApiPropertyOptional({ type: BankDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails?: BankDetailsDto;
}
