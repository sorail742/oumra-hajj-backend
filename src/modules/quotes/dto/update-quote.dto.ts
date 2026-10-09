import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateQuoteDto } from './create-quote.dto';

// Brouillon seulement ; le forfait de référence ne change pas.
export class UpdateQuoteDto extends PartialType(
  OmitType(CreateQuoteDto, ['packageId', 'currency'] as const),
) {}
