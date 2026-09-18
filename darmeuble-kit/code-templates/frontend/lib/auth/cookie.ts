/**
 * Nom du cookie d'accès — sans dépendance runtime, pour que
 * `middleware.ts` (Edge) puisse l'importer sans tirer `next/headers`.
 *
 * **Le refresh token n'a pas de nom de cookie géré ici** : il est posé
 * directement par le backend (voir docs/backend/adr/0004-*.md et
 * docs/frontend/adr/0002-*.md) — ce frontend ne le lit ni ne l'écrit
 * jamais, il relaie seulement le `Set-Cookie` du backend tel quel sur les
 * routes d'authentification (voir le proxy).
 */

export const NOM_COOKIE_ACCES = 'darmeuble_access';

/**
 * Nom du cookie de refresh — **connu ici uniquement pour le relayer**, pas
 * pour le gérer. Ce frontend ne le pose ni ne l'efface jamais lui-même
 * (voir plus haut) ; il a seulement besoin de son nom pour :
 * - extraire sa valeur d'une requête entrante et la rattacher à l'appel
 *   serveur-à-serveur vers `POST /api/auth/refresh` (`fetch()` ne
 *   transmet pas automatiquement les cookies d'une requête à une autre
 *   requête vers un hôte différent) ;
 * - relayer sans le lire le `Set-Cookie` du backend sur les routes
 *   d'authentification.
 *
 * **À vérifier contre le nom réel choisi côté backend** avant la première
 * intégration — cette constante suppose un nom, elle ne le fixe pas côté
 * serveur.
 */
export const NOM_COOKIE_REFRESH = 'darmeuble_refresh';

/**
 * Durée à vérifier contre l'environnement réellement déployé —
 * `JWT_ACCESS_EXPIRES_IN` côté backend (docs/backend/adr/0004-*.md), pas
 * une garantie contractuelle figée ici.
 */
export const DUREE_ACCES_S = 60 * 15; // 15 minutes

export const OPTIONS_COOKIE_ACCES = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'lax' as const,
  path: '/',
};
