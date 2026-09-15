import { NextResponse, type NextRequest } from "next/server";
import {
  prefixePour,
  reponseBackendInjoignable,
  urlBackend,
} from "@/lib/api/backend";
import {
  expirerJetonsSur,
  lireJetons,
  poserJetonsSur,
  renouvelerJetons,
} from "@/lib/auth/session";

/**
 * Proxy vers le backend NestJS (Oumra-hadj-project) — voir ADR-0002 de ce
 * kit.
 *
 * **À placer dans `src/app/api/[...chemin]/route.ts`** (le nom de dossier
 * de ce kit, `proxy-catch-all`, n'est pas la syntaxe de segment dynamique
 * Next — renommer au moment de la copie).
 *
 * Le navigateur appelle `/api/*`, jamais le backend directement. Cette
 * route relaie en ajoutant l'en-tête `Authorization` lu dans un cookie
 * `httpOnly`, et **gère elle-même le renouvellement du jeton** sur un
 * `401` — différence structurante avec le proxy équivalent de
 * smartsms-frontend, dont le backend n'a pas de refresh à ce jour.
 *
 * **Exception à ce proxy** : le flux calendrier ICS
 * (`GET /calendar/agency/:token/calendar.ics`) est un appel public sans
 * JWT — voir `docs/contrat-api.md`. Ne pas le faire passer par ici.
 */

const ENTETES_A_ECARTER = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  // Le cookie ne doit jamais partir vers le backend : il ne le comprend
  // pas, et le transmettre exposerait les jetons à un service qui n'en a
  // pas besoin sous cette forme.
  "cookie",
]);

function enTetesRelayees(requete: NextRequest, accessToken?: string): Headers {
  const entetes = new Headers();
  requete.headers.forEach((valeur, cle) => {
    if (!ENTETES_A_ECARTER.has(cle.toLowerCase())) {
      entetes.set(cle, valeur);
    }
  });
  if (accessToken) {
    entetes.set("Authorization", `Bearer ${accessToken}`);
  }
  return entetes;
}

async function appelerBackend(
  requete: NextRequest,
  relatif: string,
  accessToken: string | undefined,
  corpsCapture: ArrayBuffer | null,
): Promise<Response> {
  const cible = `${urlBackend()}${prefixePour(relatif)}/${relatif}${requete.nextUrl.search}`;
  return fetch(cible, {
    method: requete.method,
    headers: enTetesRelayees(requete, accessToken),
    ...(corpsCapture ? { body: corpsCapture } : {}),
    // Le proxy ne met rien en cache : c'est TanStack Query qui décide, côté
    // client. Deux caches superposés produiraient des états divergents.
    cache: "no-store",
  });
}

async function relayer(
  requete: NextRequest,
  contexte: { params: Promise<{ chemin: string[] }> },
): Promise<Response> {
  const { chemin } = await contexte.params;
  const relatif = chemin.join("/");
  const { accessToken, refreshToken } = await lireJetons();

  // Corps capturé en mémoire (`arrayBuffer`), pas streamé (`duplex: "half"`
  // comme le fait le proxy équivalent de smartsms-frontend) : un flux ne se
  // lit qu'une fois, et le rejeu après renouvellement de jeton (ci-dessous)
  // a besoin de le renvoyer une seconde fois. Compromis assumé : les
  // téléversements de documents pèlerin sont plafonnés à 10 Mo côté backend
  // (`MAX_UPLOAD_SIZE_BYTES`), ce qui reste raisonnable à bufferiser
  // entièrement. Si un flux plus lourd apparaît un jour (vidéo, archive),
  // revoir cette approche plutôt que de l'étendre telle quelle.
  const corpsCapture = requete.body ? await requete.arrayBuffer() : null;

  let reponse: Response;
  try {
    reponse = await appelerBackend(requete, relatif, accessToken, corpsCapture);
  } catch {
    return reponseBackendInjoignable(requete.nextUrl.pathname);
  }

  // Jeton d'accès refusé : tenter un renouvellement silencieux avant
  // d'abandonner — voir ADR-0002 de ce kit. Ne jamais tenter ceci sur
  // `/auth/refresh` lui-même, qui a déjà échoué à ce stade.
  if (reponse.status === 401 && refreshToken && !relatif.startsWith("auth/refresh")) {
    const nouveauxJetons = await renouvelerJetons(refreshToken);

    if (nouveauxJetons) {
      let rejeu: Response;
      try {
        rejeu = await appelerBackend(
          requete,
          relatif,
          nouveauxJetons.accessToken,
          corpsCapture,
        );
      } catch {
        return reponseBackendInjoignable(requete.nextUrl.pathname);
      }
      const relais = await construireReponse(rejeu);
      poserJetonsSur(relais, nouveauxJetons);
      return relais;
    }

    // Le refresh a échoué (expiré, révoqué) : la session est terminée.
    const relais = await construireReponse(reponse);
    expirerJetonsSur(relais);
    return relais;
  }

  return construireReponse(reponse);
}

async function construireReponse(reponse: Response): Promise<NextResponse> {
  // 204 No Content : les DELETE du backend n'ont pas de corps
  // (ex. AuthController.logout).
  if (reponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  // `arrayBuffer()`, jamais `text()` : un corps binaire (le jour où une
  // route en relaie un) serait décodé en UTF-8 par `.text()` et
  // silencieusement corrompu. Neutre pour le JSON actuel.
  const corps = await reponse.arrayBuffer();
  return new NextResponse(corps, {
    status: reponse.status,
    headers: {
      "Content-Type": reponse.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export const GET = relayer;
export const POST = relayer;
export const PUT = relayer;
export const PATCH = relayer;
export const DELETE = relayer;
