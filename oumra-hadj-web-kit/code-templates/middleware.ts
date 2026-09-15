import { NextResponse, type NextRequest } from "next/server";
import { NOM_COOKIE_ACCES } from "@/lib/auth/cookie";

/**
 * Protège les routes sans JavaScript client : un utilisateur non
 * authentifié est redirigé **avant le rendu**.
 *
 * Ne vérifie que la **présence** du cookie d'accès, jamais sa validité — le
 * middleware n'a pas le secret de signature, et le backend reste seule
 * source de vérité. Un cookie présent mais expiré passe ici ; le proxy
 * tentera alors le renouvellement automatique (voir ADR-0002 de ce kit)
 * avant, seulement en cas d'échec, de rediriger vers `/login`.
 */

/**
 * Pages accessibles sans session — à adapter aux deux parcours réels
 * (`docs/socle-frontend.md` §5) : OTP pour pèlerin/guide, email + mot de
 * passe pour agence/admin.
 */
const PREFIXES_PUBLICS = [
  "/login",
  "/otp",
  "/register-agency",
  "/forgot-password",
];

function estPublic(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  return PREFIXES_PUBLICS.some(
    (prefixe) => pathname === prefixe || pathname.startsWith(`${prefixe}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const aSession = request.cookies.has(NOM_COOKIE_ACCES);
  const routePublique = estPublic(pathname);

  if (aSession && routePublique && pathname !== "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!aSession && !routePublique) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
