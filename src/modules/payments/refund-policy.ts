import { BookingStatus } from '../../common/enums/booking-status.enum';
import { RefundPolicyTierShape, RefundRule } from '../../types/payment.types';

// Barème par défaut de la plateforme, appliqué quand l'agence n'en a pas
// défini à la réservation (idée #58 historique) : 50 % une fois la
// réservation confirmée (visa/hôtel déjà engagés).
export const DEFAULT_CONFIRMED_RATE = 0.5;

const JOUR_MS = 24 * 60 * 60 * 1000;

export interface RefundEligibility {
  rate: number;
  rule: RefundRule;
}

/** Jours pleins avant le départ (négatif une fois parti). */
export function joursAvantDepart(depart: Date, maintenant: Date): number {
  return Math.floor((depart.getTime() - maintenant.getTime()) / JOUR_MS);
}

/**
 * Taux remboursable — règle unique, appliquée côté serveur seulement :
 * - réservation non encore confirmée : 100 % (rien n'est engagé) ;
 * - annulée ou terminée : 0 % ;
 * - confirmée : palier du barème figé à la réservation dont le seuil est
 *   atteint (le plus élevé), 0 % sous le dernier palier ; sans barème,
 *   50 %.
 */
export function eligibilite(
  statut: BookingStatus,
  paliers: readonly RefundPolicyTierShape[],
  jours: number,
): RefundEligibility {
  if (statut === BookingStatus.PENDING_PAYMENT) {
    return { rate: 1, rule: 'unpaid_booking' };
  }
  if (statut !== BookingStatus.CONFIRMED) {
    return { rate: 0, rule: 'not_refundable' };
  }
  if (paliers.length === 0) {
    return { rate: DEFAULT_CONFIRMED_RATE, rule: 'platform_default' };
  }
  const palier = [...paliers]
    .sort((a, b) => b.minDaysBeforeDeparture - a.minDaysBeforeDeparture)
    .find((p) => jours >= p.minDaysBeforeDeparture);
  return palier
    ? { rate: palier.rate, rule: 'agency_tier' }
    : { rate: 0, rule: 'not_refundable' };
}

/** Lit un barème figé (JSON) sans faire confiance à sa forme. */
export function lirePaliers(json: unknown): RefundPolicyTierShape[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((p: unknown) => {
    if (typeof p !== 'object' || p === null) return [];
    const { minDaysBeforeDeparture, rate } = p as Record<string, unknown>;
    return typeof minDaysBeforeDeparture === 'number' &&
      typeof rate === 'number'
      ? [{ minDaysBeforeDeparture, rate }]
      : [];
  });
}
