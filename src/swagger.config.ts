import { DocumentBuilder } from '@nestjs/swagger';

// Partagé entre `main.ts` (docs live sur /api/docs) et
// `scripts/export-openapi.ts` (export statique pour la génération de
// modèles côté mobile) — une seule définition pour éviter que les deux
// divergent avec le temps.
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Plateforme Oumra & Hadj — API')
    .setDescription(
      'API centrale : pèlerins, agences, forfaits, réservations, paiements, documents, rites, groupes, notifications.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
