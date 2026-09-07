import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';

// Callback serveur-à-serveur du prestataire de paiement — le statut d'un
// paiement n'est jamais mis à jour uniquement côté client (voir ADR 0006).
// La vérification de signature du provider devra être ajoutée une fois
// l'agrégateur choisi.
export class PaymentWebhookDto {
  @ApiProperty()
  @IsString()
  providerReference!: string;

  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
