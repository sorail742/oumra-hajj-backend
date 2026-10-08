// Règles d'échéancier partagées par la trésorerie prévisionnelle (#38) et
// les relances préventives (#67) : une seule définition de « date limite
// du solde », pour que l'agence et le pèlerin voient la même échéance.

/** Le solde d'un forfait est dû ce nombre de jours avant le départ. */
export const BALANCE_DUE_DAYS_BEFORE_DEPARTURE = 30;

/** Rappels envoyés ce nombre de jours avant la date limite du solde. */
export const BALANCE_REMINDER_OFFSETS_DAYS = [14, 7, 1] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function balanceDueDate(departure: Date): Date {
  const due = new Date(departure);
  due.setUTCDate(due.getUTCDate() - BALANCE_DUE_DAYS_BEFORE_DEPARTURE);
  return due;
}

/** Nombre de jours calendaires (UTC) entre deux dates, `to` - `from`. */
export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((end - start) / MS_PER_DAY);
}
