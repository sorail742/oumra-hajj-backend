import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prefixePour, urlBackend } from "../api/backend";
import {
  DUREE_ACCES_S,
  DUREE_REFRESH_S,
  NOM_COOKIE_ACCES,
  NOM_COOKIE_REFRESH,
  OPTIONS_COOKIE,
} from "./cookie";

/**
 * Lecture / écriture des cookies de session, et renouvellement automatique
 * du couple de jetons.
 *
 * Ces fonctions basées sur `cookies()` (`next/headers`) sont réservées au
 * contexte serveur (Route Handlers, Server Components). Le middleware lit
 * le cookie autrement, via `request.cookies`, et n'importe que
 * `NOM_COOKIE_ACCES` depuis `./cookie` — voir `docs/socle-frontend.md` §5 et
 * ADR-0002 de ce kit.
 */

export interface Jetons {
  accessToken: string;
  refreshToken: string;
}

/** Lit les deux jetons de la requête courante. */
export async function lireJetons(): Promise<Partial<Jetons>> {
  const magasin = await cookies();
  return {
    accessToken: magasin.get(NOM_COOKIE_ACCES)?.value,
    refreshToken: magasin.get(NOM_COOKIE_REFRESH)?.value,
  };
}

/** Pose les deux cookies de session. */
export async function poserJetons(jetons: Jetons): Promise<void> {
  const magasin = await cookies();
  magasin.set(NOM_COOKIE_ACCES, jetons.accessToken, {
    ...OPTIONS_COOKIE,
    maxAge: DUREE_ACCES_S,
  });
  magasin.set(NOM_COOKIE_REFRESH, jetons.refreshToken, {
    ...OPTIONS_COOKIE,
    maxAge: DUREE_REFRESH_S,
  });
}

/** Efface les deux cookies. `maxAge: 0` plutôt que `delete` : le `path` doit correspondre à celui posé. */
export async function effacerJetons(): Promise<void> {
  const magasin = await cookies();
  magasin.set(NOM_COOKIE_ACCES, "", { ...OPTIONS_COOKIE, maxAge: 0 });
  magasin.set(NOM_COOKIE_REFRESH, "", { ...OPTIONS_COOKIE, maxAge: 0 });
}

/** Variante pour le proxy, qui bâtit sa `NextResponse` à la main. */
export function poserJetonsSur(reponse: NextResponse, jetons: Jetons): void {
  reponse.cookies.set(NOM_COOKIE_ACCES, jetons.accessToken, {
    ...OPTIONS_COOKIE,
    maxAge: DUREE_ACCES_S,
  });
  reponse.cookies.set(NOM_COOKIE_REFRESH, jetons.refreshToken, {
    ...OPTIONS_COOKIE,
    maxAge: DUREE_REFRESH_S,
  });
}

export function expirerJetonsSur(reponse: NextResponse): void {
  reponse.cookies.set(NOM_COOKIE_ACCES, "", { ...OPTIONS_COOKIE, maxAge: 0 });
  reponse.cookies.set(NOM_COOKIE_REFRESH, "", { ...OPTIONS_COOKIE, maxAge: 0 });
}

/**
 * Renouvellement du couple de jetons — voir ADR-0002 de ce kit.
 *
 * **Un seul appel à `POST /auth/refresh` en vol à la fois par processus
 * serveur.** Sans ce verrou, n requêtes qui échouent simultanément en `401`
 * déclencheraient n appels de renouvellement concurrents ; avec la rotation
 * du refresh token côté backend, seul le premier réussirait et les autres
 * invalideraient la session au lieu de la prolonger.
 *
 * Limite assumée : verrou en mémoire du processus Node, pas partagé entre
 * plusieurs instances. Sur un déploiement à plusieurs instances sans état
 * partagé, deux instances peuvent chacune déclencher un renouvellement au
 * même instant — sans conséquence fonctionnelle grâce à la rotation
 * (le backend accepte les deux, la précédente est simplement invalidée),
 * mais à revoir avec un verrou partagé (Redis) si la charge sur
 * `/auth/refresh` s'avère significative.
 */
let renouvellementEnCours: Promise<Jetons | null> | null = null;

export async function renouvelerJetons(
  refreshToken: string,
): Promise<Jetons | null> {
  renouvellementEnCours ??= (async () => {
    try {
      const chemin = "auth/refresh";
      const reponse = await fetch(
        `${urlBackend()}${prefixePour(chemin)}/${chemin}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          cache: "no-store",
        },
      );
      if (!reponse.ok) {
        return null;
      }
      return (await reponse.json()) as Jetons;
    } catch {
      return null;
    } finally {
      // Le verrou ne couvre que la durée d'une tentative : une fois résolue
      // (succès ou échec), le prochain 401 doit pouvoir en déclencher une
      // nouvelle normalement.
      renouvellementEnCours = null;
    }
  })();
  return renouvellementEnCours;
}
