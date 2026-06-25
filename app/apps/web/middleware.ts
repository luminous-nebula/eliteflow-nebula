import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from './lib/constants';

/**
 * Lightweight UX gate: redirect to /login when the session cookie is absent.
 * Cryptographic verification happens server-side (lib/auth.requireOperator);
 * this only avoids rendering protected pages for clearly-unauthenticated requests.
 */
const PUBLIC_PATHS = ['/login'];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/auth') || PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
