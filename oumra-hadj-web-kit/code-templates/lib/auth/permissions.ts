import { z } from "zod";

/**
 * Rôles et test de droits — **partagés**, ne peuvent pas vivre dans un
 * `features/`. Forme relevée sur `Oumra-hadj-project`
 * (`src/common/enums/role.enum.ts`).
 *
 * **Beaucoup plus simple que l'équivalent smartsms-frontend** : quatre
 * rôles à plat, aucune matrice de permissions à interroger (aucune route
 * `GET /api/permissions/matrix` ou `GET /me` équivalente n'existe côté
 * backend à ce jour). `<Can>` teste donc directement le rôle — pas une
 * permission fine.
 */

export const roleSchema = z.enum(["pilgrim", "agency", "guide", "admin"]);

export type Role = z.infer<typeof roleSchema>;

export type ModeCan = "all" | "any";

/**
 * L'utilisateur a-t-il l'un des rôles requis ? `any` (défaut, puisqu'un
 * utilisateur n'a jamais qu'un seul rôle à la fois ici — contrairement à
 * une matrice de permissions cumulables) : au moins un rôle de la liste
 * correspond. Sans rôle connu (`undefined`) : `false` — on ne montre jamais
 * une action par défaut.
 */
export function hasRole(
  roleActuel: Role | undefined,
  requis: Role | readonly Role[],
  mode: ModeCan = "any",
): boolean {
  if (!roleActuel) {
    return false;
  }
  const liste: readonly Role[] = Array.isArray(requis) ? requis : [requis];
  if (liste.length === 0) {
    return true;
  }
  // `mode: "all"` n'a de sens que si un jour un utilisateur peut cumuler
  // plusieurs rôles (voir ADR 0021 backend, proposé — multi-utilisateurs
  // par agence). Avec un rôle unique par utilisateur, "all" et "any" ne
  // peuvent différer que si `requis` porte plus d'une valeur, auquel cas
  // "all" est toujours faux pour un rôle unique — géré explicitement plutôt
  // que de laisser un mode mal choisi produire un résultat surprenant.
  return mode === "all"
    ? liste.length === 1 && liste[0] === roleActuel
    : liste.includes(roleActuel);
}

/**
 * Portée connue de chaque rôle, à titre de documentation — voir
 * `docs/socle-frontend.md` §6 pour le détail par domaine. **Ne remplace pas
 * une vérification backend** : le rôle affiché correctement côté client
 * n'empêche jamais un accès refusé côté serveur si l'UI a un trou.
 */
export const PORTEE_ROLES: Record<Role, string> = {
  pilgrim:
    "Réserver, payer, téléverser ses documents, suivre son dossier, laisser un avis, déclencher le SOS",
  guide: "Accompagner un groupe, recevoir les messages agence",
  agency:
    "Gérer ses forfaits, valider les documents, gérer les remboursements, son score de confiance, ses documents légaux, son calendrier",
  admin: "Valider/rejeter une agence, accès transverse",
};
