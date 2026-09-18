import { NextResponse, type NextRequest } from 'next/server';
import { NOM_COOKIE_ACCES } from '@/lib/auth/cookie';

/**
 * Protège les routes sans JavaScript client. Ne vérifie que la
 * **présence** du cookie d'accès, jamais sa validité — le backend reste
 * seule source de vérité. Un cookie présent mais expiré passe ici ; le
 * proxy tentera le renouvellement automatique avant, seulement en cas
 * d'échec, de rediriger vers `/login`.
 *
 * **Ne route pas vers l'un des trois espaces** (organization/tenant/
 * super-admin, voir docs/frontend/socle-frontend.md §1) selon le rôle :
 * cette décision se prend après connexion, à partir de la réponse de
 * `POST /api/auth/login`/`otp/verify`, pas ici — le middleware n'a pas
 * accès au rôle (il ne décode pas le JWT, volontairement, voir
 * docs/backend/multi-tenant.md).
 */

const PREFIXES_PUBLICS = ['/login', '/otp', '/forgot-password'];

function estPublic(pathname: string): boolean {
  if (pathname === '/') {
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

  if (aSession && routePublique && pathname !== '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!aSession && !routePublique) {
    const destination = new URL('/login', request.url);
    destination.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
