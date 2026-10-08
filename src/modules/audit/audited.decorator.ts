import { SetMetadata } from '@nestjs/common';

export const AUDITED_KEY = 'audited';

export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditedOptions {
  action: string;
  entityType: string;
  // Paramètre de route portant l'identifiant de l'entité (défaut : `id`) ;
  // à défaut, l'`id` de la réponse (création).
  idParam?: string;
  // Références et montants tirés de la réponse — jamais de contenu
  // sensible (ADR 0008).
  metadata?: (reponse: unknown) => AuditMetadata | undefined;
}

/**
 * Marque une route comme action sensible : l'intercepteur d'audit
 * l'enregistre (qui, quoi, quand, sur quelle entité) une fois réussie.
 * Un échec n'est pas journalisé ici — rien n'a changé.
 */
export const Audited = (options: AuditedOptions) =>
  SetMetadata(AUDITED_KEY, options);

/** Lit un champ scalaire d'une réponse sans supposer sa forme. */
export function champ(
  reponse: unknown,
  cle: string,
): string | number | boolean | null {
  if (typeof reponse !== 'object' || reponse === null) return null;
  const valeur = (reponse as Record<string, unknown>)[cle];
  return typeof valeur === 'string' ||
    typeof valeur === 'number' ||
    typeof valeur === 'boolean'
    ? valeur
    : null;
}
