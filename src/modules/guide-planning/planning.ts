import {
  PlanningConflictShape,
  PlanningEntryShape,
} from '../../types/guide-planning.types';

export interface Periode {
  startDate: Date;
  endDate: Date;
}

/** Deux périodes, bornes incluses, ont-elles au moins un jour commun ? */
export function chevauche(a: Periode, b: Periode): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/** Chaque paire d'entrées du planning qui se chevauche, une seule fois. */
export function conflits(
  entrees: readonly PlanningEntryShape[],
): PlanningConflictShape[] {
  const trouves: PlanningConflictShape[] = [];
  entrees.forEach((a, i) => {
    for (const b of entrees.slice(i + 1)) {
      if (chevauche(a, b)) {
        trouves.push({
          firstId: a.id,
          secondId: b.id,
          startDate: a.startDate > b.startDate ? a.startDate : b.startDate,
          endDate: a.endDate < b.endDate ? a.endDate : b.endDate,
        });
      }
    }
  });
  return trouves;
}
