/**
 * Noms et options des cookies de session — **sans aucune dépendance
 * runtime**, pour que `middleware.ts` (Edge) puisse importer
 * `NOM_COOKIE_ACCES` sans tirer `next/headers`, indisponible côté Edge.
 *
 * Deux cookies, pas un — voir ADR-0002 de ce kit : le backend
 * Oumra-hadj-project a un couple access/refresh en rotation, contrairement
 * au jeton unique sans refresh de smartsms-backend.
 */

export const NOM_COOKIE_ACCES = "oumra_access";
export const NOM_COOKIE_REFRESH = "oumra_refresh";

/**
 * Durées à **vérifier contre l'environnement réellement déployé** avant de
 * les figer : ce sont les valeurs par défaut du backend
 * (`JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d`,
 * `src/config/configuration.ts`), pas une garantie contractuelle. Un cookie
 * qui survit plus longtemps que le jeton qu'il transporte fait croire à une
 * session valide alors que chaque appel échouerait en 401.
 */
export const DUREE_ACCES_S = 60 * 15; // 15 minutes
export const DUREE_REFRESH_S = 60 * 60 * 24 * 30; // 30 jours

/**
 * Options communes. `secure` désactivé seulement en développement, où
 * `localhost` est servi en clair.
 */
export const OPTIONS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: "lax" as const,
  path: "/",
};
