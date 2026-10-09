import { QuoteTotalsShape } from '../../types/quote.types';

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Totaux d'un devis, toujours calculés ici à partir des lignes : jamais
 * repris d'un montant envoyé par le navigateur.
 */
export function calculerTotaux(
  lignes: { label: string; quantity: number; unitPrice: number }[],
  discountRate: number,
  currency: string,
): QuoteTotalsShape {
  const lines = lignes.map((l) => ({
    label: l.label.trim(),
    quantity: l.quantity,
    unitPrice: arrondi(l.unitPrice),
    total: arrondi(l.quantity * l.unitPrice),
  }));
  const subtotal = arrondi(lines.reduce((s, l) => s + l.total, 0));
  const discountAmount = arrondi(subtotal * discountRate);
  return {
    currency,
    lines,
    subtotal,
    discountRate,
    discountAmount,
    totalAmount: arrondi(subtotal - discountAmount),
  };
}

/** DEV-2026-00042 */
export function numeroDevis(annee: number, sequence: number): string {
  return `DEV-${annee}-${String(sequence).padStart(5, '0')}`;
}
